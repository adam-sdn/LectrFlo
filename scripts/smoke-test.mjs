// End-to-end API smoke test against a running app + Supabase (e.g. `supabase start` + `npm run dev`).
// Usage: APP_URL=http://localhost:3000 NEXT_PUBLIC_SUPABASE_URL=... NEXT_PUBLIC_SUPABASE_ANON_KEY=... \
//        SUPABASE_SERVICE_ROLE_KEY=... [EXPECT_AI=unavailable|failing] [MOCK_GEMINI_URL=...] node scripts/smoke-test.mjs
// Creates throwaway lecturer accounts and a lecture, then deletes the lecture.

import { createClient } from "@supabase/supabase-js";

const APP = process.env.APP_URL ?? "http://localhost:3000";
// "available" (default, real or mock provider), "unavailable" (no GEMINI_API_KEY) or "failing" (provider errors)
const AI_MODE = process.env.EXPECT_AI ?? "available";
const SB_URL = process.env.NEXT_PUBLIC_SUPABASE_URL;
const ANON = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;
const SERVICE = process.env.SUPABASE_SERVICE_ROLE_KEY;
if (!SB_URL || !ANON || !SERVICE) throw new Error("Supabase env vars are required");

let failures = 0;
function check(name, condition, detail) {
  if (condition) console.log(`  ok   ${name}`);
  else {
    failures++;
    console.log(`  FAIL ${name}`, detail ?? "");
  }
}

async function api(path, { method = "GET", token, cookie, body, form } = {}) {
  const headers = {};
  if (token) headers.authorization = `Bearer ${token}`;
  if (cookie) headers.cookie = cookie;
  if (body !== undefined) headers["content-type"] = "application/json";
  const res = await fetch(`${APP}${path}`, {
    method,
    headers,
    body: form ?? (body !== undefined ? JSON.stringify(body) : undefined),
  });
  const type = res.headers.get("content-type") ?? "";
  const data = type.includes("json") ? await res.json() : await res.text();
  return { status: res.status, data, headers: res.headers };
}

async function createLecturer(name) {
  const email = `${name}-${Date.now()}@example.com`;
  const admin = createClient(SB_URL, SERVICE, { auth: { persistSession: false } });
  const { error } = await admin.auth.admin.createUser({
    email,
    password: "password-123",
    email_confirm: true,
    user_metadata: { full_name: `Dr ${name}` },
  });
  if (error) throw error;
  const client = createClient(SB_URL, ANON, { auth: { persistSession: false } });
  const { data, error: signInError } = await client.auth.signInWithPassword({ email, password: "password-123" });
  if (signInError) throw signInError;
  return data.session.access_token;
}

// 1x1 PNG
const PNG = Buffer.from(
  "iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mP8z8BQDwAEhQGAhKmMIQAAAABJRU5ErkJggg==",
  "base64",
);

function slidesForm(count, type = "image/png") {
  const form = new FormData();
  for (let i = 0; i < count; i++) form.append("files", new Blob([PNG], { type }), `slide-${i + 1}.png`);
  return form;
}

function cookieFrom(res) {
  return res.headers.get("set-cookie")?.split(";")[0];
}

const sleep = (ms) => new Promise((r) => setTimeout(r, ms));

async function main() {
  console.log("Lecturer setup");
  const lecturer = await createLecturer("ada");
  const otherLecturer = await createLecturer("bob");

  check("unauthenticated lecturer request is rejected", (await api("/api/lectures")).status === 401);

  const created = await api("/api/lectures", { method: "POST", token: lecturer, body: { title: "Graph Algorithms", module: "CS201" } });
  check("create lecture", created.status === 201, created.data);
  const lecture = created.data.lecture;
  const id = lecture.id;
  check("lecture has join code and lecturer name", /^[A-Z2-9]{6}$/.test(lecture.joinCode) && lecture.lecturerName === "Dr ada");
  check("validation error on empty title", (await api("/api/lectures", { method: "POST", token: lecturer, body: { title: "" } })).status === 400);

  check("other lecturer cannot see lecture", (await api(`/api/lectures/${id}`, { token: otherLecturer })).status === 404);
  check("other lecturer cannot start lecture", (await api(`/api/lectures/${id}/lifecycle`, { method: "POST", token: otherLecturer, body: { action: "start" } })).status === 404);
  check("bad lecture id is 404", (await api(`/api/lectures/not-a-uuid`, { token: lecturer })).status === 404);

  // Realtime subscriptions
  const events = [];
  const rt = createClient(SB_URL, ANON, { auth: { persistSession: false } });
  const subscribe = (name) =>
    new Promise((resolve) => {
      rt.channel(name)
        .on("broadcast", { event: "*" }, (msg) => events.push({ channel: name, event: msg.event, payload: msg.payload }))
        .subscribe((status) => status === "SUBSCRIBED" && resolve());
    });
  await Promise.all([subscribe(`lecture:${id}`), subscribe(lecture.hostChannel)]);

  console.log("Slides and objectives");
  const upload = await api(`/api/lectures/${id}/slides`, { method: "POST", token: lecturer, form: slidesForm(3) });
  check("upload 3 slides", upload.status === 201 && upload.data.slides.length === 3, upload.data);
  const image = await fetch(upload.data.slides[0].imageUrl);
  check("signed slide URL serves the image", image.ok && (await image.arrayBuffer()).byteLength === PNG.length);
  check("reject non-image slides", (await api(`/api/lectures/${id}/slides`, { method: "POST", token: lecturer, form: slidesForm(1, "application/pdf") })).status === 415);
  const text = await api(`/api/lectures/${id}/slides/2`, { method: "PATCH", token: lecturer, body: { textContent: "Breadth-first search uses a queue" } });
  check("set slide text", text.status === 200 && text.data.slide.textContent.startsWith("Breadth"), text.data);
  const objectives = await api(`/api/lectures/${id}/objectives`, { method: "PUT", token: lecturer, body: { objectives: ["Explain BFS", "Compare BFS and DFS"] } });
  check("set objectives", objectives.status === 200 && objectives.data.objectives.length === 2, objectives.data);
  const generated = await api(`/api/lectures/${id}/objectives/generate`, { method: "POST", token: lecturer });
  if (AI_MODE === "unavailable") check("objective generation unavailable", generated.status === 503, generated.data);
  else if (AI_MODE === "failing") check("objective generation failure", generated.status === 502, generated.data);
  else check("generate objectives with AI", generated.data.objectives?.[0]?.source === "ai", generated.data);

  console.log("Joining");
  check("empty code", (await api("/api/join", { method: "POST", body: { code: " ", displayName: "Sam" } })).data.error?.code === "code_required");
  check("malformed code", (await api("/api/join/abc")).data.error?.code === "invalid_code");
  check("unknown code", (await api("/api/join/ZZZZZZ")).status === 404);
  check("draft lecture is not joinable", (await api(`/api/join/${lecture.joinCode}`)).data.error?.code === "lecture_not_open");

  const opened = await api(`/api/lectures/${id}/lifecycle`, { method: "POST", token: lecturer, body: { action: "open" } });
  check("open lobby", opened.data.lecture?.status === "lobby", opened.data);
  check("cannot open twice", (await api(`/api/lectures/${id}/lifecycle`, { method: "POST", token: lecturer, body: { action: "open" } })).status === 409);

  const preview = await api(`/api/join/${lecture.joinCode.toLowerCase()}`);
  check("preview lecture by code (case-insensitive)", preview.data.lecture?.title === "Graph Algorithms", preview.data);

  const joinA = await api("/api/join", { method: "POST", body: { code: lecture.joinCode, displayName: "Sam" } });
  const cookieA = cookieFrom(joinA);
  check("student A joins", joinA.status === 201 && cookieA, joinA.data);
  check("participant cookie is httpOnly", /httponly/i.test(joinA.headers.get("set-cookie") ?? ""));
  const rejoin = await api("/api/join", { method: "POST", cookie: cookieA, body: { code: lecture.joinCode, displayName: "Samantha" } });
  check("rejoin keeps participant", rejoin.status === 200 && rejoin.data.participant.id === joinA.data.participant.id, rejoin.data);
  const joinB = await api("/api/join", { method: "POST", body: { code: lecture.joinCode, displayName: "Alex" } });
  const cookieB = cookieFrom(joinB);

  const lobbyState = await api(`/api/student/lectures/${id}`, { cookie: cookieA });
  check("lobby state: no slides revealed, objectives visible", lobbyState.data.slides?.length === 0 && lobbyState.data.objectives.length >= 2, lobbyState.data);
  check("student state requires join", (await api(`/api/student/lectures/${id}`)).status === 401);
  check("cookie for another lecture is rejected", (await api(`/api/student/lectures/00000000-0000-0000-0000-000000000000`, { cookie: cookieA })).status === 401);
  check("confusion not allowed in lobby", (await api(`/api/student/lectures/${id}/confusion`, { method: "POST", cookie: cookieA })).status === 409);

  console.log("Live lecture");
  const started = await api(`/api/lectures/${id}/lifecycle`, { method: "POST", token: lecturer, body: { action: "start" } });
  check("start lecture", started.data.lecture?.status === "live" && started.data.lecture.startedAt, started.data);
  check("cannot go past last slide", (await api(`/api/lectures/${id}/current-slide`, { method: "PUT", token: lecturer, body: { slideNumber: 4 } })).status === 400);
  check("advance to slide 2", (await api(`/api/lectures/${id}/current-slide`, { method: "PUT", token: lecturer, body: { slideNumber: 2 } })).data.lecture?.currentSlide === 2);

  const liveState = await api(`/api/student/lectures/${id}`, { cookie: cookieA });
  check("live state reveals slides 1-2", liveState.data.slides.length === 2 && liveState.data.lecture.currentSlide === 2, liveState.data);
  check("student state hides join code and host channel", !JSON.stringify(liveState.data).includes(lecture.joinCode) && !JSON.stringify(liveState.data).includes(lecture.hostChannel));

  const notes = await api(`/api/student/lectures/${id}/notes`, { method: "PUT", cookie: cookieA, body: { content: "BFS uses a queue" } });
  check("save notes", notes.status === 200 && notes.data.notes.updatedAt, notes.data);
  const notes2 = await api(`/api/student/lectures/${id}/notes`, { method: "PUT", cookie: cookieA, body: { content: "BFS uses a FIFO queue" } });
  check("update notes", notes2.data.notes.content === "BFS uses a FIFO queue");
  check("notes are private", (await api(`/api/student/lectures/${id}/notes`, { cookie: cookieB })).data.notes.content === "");

  const ann = await api(`/api/student/lectures/${id}/annotations`, { method: "POST", cookie: cookieA, body: { slideNumber: 2, content: "Revisit", x: 0.4, y: 0.6 } });
  check("create annotation", ann.status === 201, ann.data);
  check("cannot annotate unrevealed slide", (await api(`/api/student/lectures/${id}/annotations`, { method: "POST", cookie: cookieA, body: { slideNumber: 3, content: "x" } })).status === 400);
  const annId = ann.data.annotation.id;
  check("edit annotation", (await api(`/api/student/lectures/${id}/annotations/${annId}`, { method: "PATCH", cookie: cookieA, body: { content: "Revisit queues" } })).data.annotation?.content === "Revisit queues");
  check("other student cannot edit annotation", (await api(`/api/student/lectures/${id}/annotations/${annId}`, { method: "PATCH", cookie: cookieB, body: { content: "hacked" } })).status === 404);
  check("other student cannot delete annotation", (await api(`/api/student/lectures/${id}/annotations/${annId}`, { method: "DELETE", cookie: cookieB })).status === 404);
  const tmp = await api(`/api/student/lectures/${id}/annotations`, { method: "POST", cookie: cookieA, body: { slideNumber: 1, content: "temp" } });
  check("delete annotation", (await api(`/api/student/lectures/${id}/annotations/${tmp.data.annotation.id}`, { method: "DELETE", cookie: cookieA })).status === 204);
  check("list annotations", (await api(`/api/student/lectures/${id}/annotations`, { cookie: cookieA })).data.annotations.length === 1);

  const conf = await api(`/api/student/lectures/${id}/confusion`, { method: "POST", cookie: cookieA });
  check("confusion signal", conf.status === 201 && conf.data.slideNumber === 2, conf.data);
  const again = await api(`/api/student/lectures/${id}/confusion`, { method: "POST", cookie: cookieA });
  check("confusion cooldown", again.status === 429 && again.data.error.details.retryAfterSeconds > 0, again.data);
  await api(`/api/student/lectures/${id}/confusion`, { method: "POST", cookie: cookieB });
  const summary = await api(`/api/lectures/${id}/confusion`, { token: lecturer });
  check("lecturer sees aggregate confusion", summary.data.recentUniqueStudents === 2 && summary.data.participantCount === 2, summary.data);

  const q = await api(`/api/student/lectures/${id}/questions`, { method: "POST", cookie: cookieA, body: { body: "Why a queue and not a stack?" } });
  check("ask lecturer", q.status === 201 && q.data.question.slideNumber === 2, q.data);
  const lq = await api(`/api/lectures/${id}/questions`, { token: lecturer });
  check("lecturer sees question without identity", lq.data.questions.length === 1 && !("participantId" in lq.data.questions[0]), lq.data);
  check("mark answered", (await api(`/api/lectures/${id}/questions/${lq.data.questions[0].id}`, { method: "PATCH", token: lecturer, body: { status: "answered" } })).data.question?.status === "answered");
  check("student sees own question status", (await api(`/api/student/lectures/${id}/questions`, { cookie: cookieA })).data.questions[0].status === "answered");
  check("student B has no questions", (await api(`/api/student/lectures/${id}/questions`, { cookie: cookieB })).data.questions.length === 0);

  const ai = await api(`/api/student/lectures/${id}/ai`, { method: "POST", cookie: cookieA, body: { message: "Explain BFS" } });
  if (AI_MODE === "unavailable") {
    check("AI unavailable without provider", ai.status === 503 && ai.data.error.code === "ai_unavailable", ai.data);
  } else if (AI_MODE === "failing") {
    check("AI failure is reported", ai.status === 502 && ai.data.error.details.message.status === "failed", ai.data);
    const history = await api(`/api/student/lectures/${id}/ai`, { cookie: cookieA });
    check("failed AI message kept in history", history.data.messages.length === 1 && history.data.messages[0].status === "failed", history.data);
  } else {
    check("AI answers", ai.status === 201 && ai.data.messages[1].role === "assistant", ai.data);
    const followUp = await api(`/api/student/lectures/${id}/ai`, { method: "POST", cookie: cookieA, body: { message: "And DFS?" } });
    check("AI follow-up", followUp.status === 201, followUp.data);
    const history = await api(`/api/student/lectures/${id}/ai`, { cookie: cookieA });
    check("AI history has 4 messages", history.data.messages.length === 4, history.data);
    check("AI history is private", (await api(`/api/student/lectures/${id}/ai`, { cookie: cookieB })).data.messages.length === 0);
    if (process.env.MOCK_GEMINI_URL) {
      const sent = await (await fetch(`${process.env.MOCK_GEMINI_URL}/requests`)).json();
      const tutor = sent.filter((r) => r.body.systemInstruction.parts[0].text.includes("Lecture AI"));
      const first = tutor[0]?.body;
      check("AI context: lecture, objectives, revealed slide text", first?.systemInstruction.parts[0].text.includes("Graph Algorithms") && first.systemInstruction.parts[0].text.includes("Explain breadth-first search") && first.systemInstruction.parts[0].text.includes("[Slide 2] Breadth-first"));
      check("AI context: current slide image attached", first?.contents.at(-1).parts.some((p) => p.inlineData?.mimeType === "image/png"));
      check("AI context: follow-up includes history", tutor[1]?.body.contents.length === 3 && tutor[1].body.contents[0].role === "user" && tutor[1].body.contents[1].role === "model");
    }
  }

  const lecturerView = await api(`/api/lectures/${id}`, { token: lecturer });
  check("lecturer detail lists participants", lecturerView.data.lecture.participantCount === 2 && lecturerView.data.lecture.participants[0].displayName === "Samantha", lecturerView.data);

  console.log("Ending");
  check("recap not available while live", (await api(`/api/student/lectures/${id}/recap`, { cookie: cookieA })).status === 409);
  const ended = await api(`/api/lectures/${id}/lifecycle`, { method: "POST", token: lecturer, body: { action: "end" } });
  check("end lecture", ended.data.lecture?.status === "ended" && ended.data.lecture.endedAt, ended.data);
  check("ended lecture rejects joins", (await api("/api/join", { method: "POST", body: { code: lecture.joinCode, displayName: "Late" } })).status === 410);
  check("questions closed after end", (await api(`/api/student/lectures/${id}/questions`, { method: "POST", cookie: cookieA, body: { body: "late" } })).data.error?.code === "lecture_ended");
  check("notes still editable after end", (await api(`/api/student/lectures/${id}/notes`, { method: "PUT", cookie: cookieA, body: { content: "BFS uses a FIFO queue. Review DFS." } })).status === 200);
  check("all slides revealed after end", (await api(`/api/student/lectures/${id}`, { cookie: cookieA })).data.slides.length === 3);

  const recap = await api(`/api/student/lectures/${id}/recap`, { cookie: cookieA });
  check(
    "recap includes the student's data",
    recap.status === 200 && recap.data.report === null && recap.data.annotations.length === 1 && recap.data.confusedSlides.join() === "2" && recap.data.notes.content.includes("Review DFS"),
    recap.data,
  );
  const genRecap = await api(`/api/student/lectures/${id}/recap`, { method: "POST", cookie: cookieA });
  const report = await api(`/api/lectures/${id}/report`, { method: "POST", token: lecturer });
  if (AI_MODE === "unavailable") {
    check("recap generation unavailable", genRecap.status === 503, genRecap.data);
    check("report generation unavailable", report.status === 503, report.data);
  } else if (AI_MODE === "failing") {
    check("recap generation failure recorded", genRecap.status === 200 && genRecap.data.report.status === "failed", genRecap.data);
    check("report failure recorded with stats", report.status === 200 && report.data.report.status === "failed" && report.data.stats.questionCount === 1, report.data);
  } else {
    check("recap generated", genRecap.data.report?.status === "complete" && genRecap.data.report.content.keyConcepts.length > 0, genRecap.data);
    check("report generated", report.data.report?.status === "complete" && report.data.report.content.confusionHotspots[0].slideNumber === 2, report.data);
    const cached = await api(`/api/student/lectures/${id}/recap`, { method: "POST", cookie: cookieA });
    check("recap is not regenerated unless asked", cached.data.report?.updatedAt === genRecap.data.report.updatedAt);
  }
  const reportGet = await api(`/api/lectures/${id}/report`, { token: lecturer });
  check("report stats", reportGet.data.stats.participantCount === 2 && reportGet.data.stats.confusion[0].uniqueStudents === 2, reportGet.data);

  const exported = await api(`/api/student/lectures/${id}/export`, { cookie: cookieA });
  check(
    "export notes as markdown",
    exported.status === 200 && exported.headers.get("content-disposition")?.includes("Graph-Algorithms-notes.md") && exported.data.includes("Revisit queues"),
    exported.data,
  );

  await sleep(1000);
  const seen = (channel, event) => events.some((e) => e.channel === channel && e.event === event);
  const states = events.filter((e) => e.event === "lecture_state").map((e) => e.payload.status);
  check("realtime: lecture_state events", ["lobby", "live", "ended"].every((s) => states.includes(s)), states);
  check("realtime: slides_updated", seen(`lecture:${id}`, "slides_updated"));
  check("realtime: objectives_updated", seen(`lecture:${id}`, "objectives_updated"));
  check("realtime: participant_joined", seen(lecture.hostChannel, "participant_joined"));
  check("realtime: confusion", seen(lecture.hostChannel, "confusion"));
  check("realtime: question_created", seen(lecture.hostChannel, "question_created"));
  check("realtime: host events not on public channel", !events.some((e) => e.channel === `lecture:${id}` && e.event === "confusion"));
  await rt.removeAllChannels();

  check("delete lecture", (await api(`/api/lectures/${id}`, { method: "DELETE", token: lecturer })).status === 204);
  check("deleted lecture is gone", (await api(`/api/lectures/${id}`, { token: lecturer })).status === 404);

  console.log(failures === 0 ? "\nAll checks passed" : `\n${failures} check(s) failed`);
  process.exit(failures === 0 ? 0 : 1);
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
