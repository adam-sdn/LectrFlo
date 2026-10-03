# LectrFlow API

All endpoints are Next.js route handlers under `src/app/api`. Request and response
bodies are JSON (camelCase). TypeScript shapes for every response live in
`src/lib/types.ts`.

## Conventions

- **Errors** always use `{ "error": { "code": string, "message": string, "details"?: unknown } }`.
  `message` is safe to show to users; branch on `code`.
- **Validation** failures return `400 validation_error` with zod `details`
  (`formErrors`, `fieldErrors`).
- **Rate limits / cooldowns** return `429` with `details.retryAfterSeconds`.
- **Lecture state conflicts** return `409` with `lecture_not_live`, `lecture_ended` or `invalid_transition`.
- **Unknown or not-owned resources** return `404 not_found` (never `403`, so lecture IDs are not probed).
- **AI not configured** returns `503 ai_unavailable`. **AI provider failure** returns `502 ai_failed`.

## Authentication

| Caller | Mechanism |
| --- | --- |
| Lecturer | Supabase Auth session. Browser: the `@supabase/ssr` auth cookie (sign in with `browserClient().auth.*`). Other clients: `Authorization: Bearer <access_token>`. Missing/invalid → `401 unauthenticated`. |
| Student | No account. `POST /api/join` sets an httpOnly cookie `lf_participant_<lectureId>` (24h). Same-origin `fetch` sends it automatically. Missing/expired → `401 not_joined` (send the student back to the join screen). |

## Lecture lifecycle

```
draft --open--> lobby --start--> live --end--> ended
  \____________start____________/      lobby --end--> ended
```

- `draft`: lecturer prepares slides/objectives. Not joinable.
- `lobby`: join code is live; students wait. Students see objectives but no slides.
- `live`: students see slides up to the current slide; confusion, questions enabled.
- `ended`: all slides visible; recap and reports available; notes/annotations still editable.

## Lecturer endpoints

| Method & path | Body | Response |
| --- | --- | --- |
| `GET /api/lectures` | – | `{ lectures: LecturerLecture[] }` newest first |
| `POST /api/lectures` | `{ title, module?, description? }` | `201 { lecture: LecturerLecture }` (includes `joinCode`, `hostChannel`) |
| `GET /api/lectures/:id` | – | `{ lecture: LecturerLectureDetail }` (slides with signed URLs, objectives, participants) |
| `PATCH /api/lectures/:id` | `{ title?, module?, description? }` | `{ lecture }` |
| `DELETE /api/lectures/:id` | – | `204`; deletes all lecture data and slide images |
| `POST /api/lectures/:id/lifecycle` | `{ action: "open" \| "start" \| "end" }` | `{ lecture }`; `409 invalid_transition` |
| `PUT /api/lectures/:id/current-slide` | `{ slideNumber }` | `{ lecture }`; `400 invalid_slide` if out of range; not allowed when ended |
| `GET /api/lectures/:id/slides` | – | `{ slides: Slide[] }` |
| `POST /api/lectures/:id/slides` | multipart, field `files` (PNG/JPEG/WebP, ≤10 MB each, one per slide, in order) | `201 { slides }`; appends after existing slides. `415`, `413`, `400 too_many_slides` (max 150) |
| `DELETE /api/lectures/:id/slides` | – | `204`; removes all slides (draft/lobby only) |
| `PATCH /api/lectures/:id/slides/:n` | `{ textContent: string \| null }` | `{ slide: { slideNumber, textContent } }`; text is used as AI context |
| `GET /api/lectures/:id/objectives` | – | `{ objectives: LearningObjective[] }` |
| `PUT /api/lectures/:id/objectives` | `{ objectives: string[] }` (≤10) | `{ objectives }` replaces the list |
| `POST /api/lectures/:id/objectives/generate` | – | `{ objectives }` AI-extracted from slide text (or slide images); replaces the list. `400 no_slides`, `503`, `502` |
| `GET /api/lectures/:id/questions` | – | `{ questions: LecturerQuestion[] }` oldest first, anonymous |
| `PATCH /api/lectures/:id/questions/:qid` | `{ status: "open" \| "answered" \| "dismissed" }` | `{ question }` |
| `GET /api/lectures/:id/confusion` | – | `ConfusionSummary` (recent window = 120 s, distinct students on current slide, per-slide totals) |
| `GET /api/lectures/:id/report` | – | `LecturerReportResponse` (`report` null until generated; `stats` always present) |
| `POST /api/lectures/:id/report` | `{ regenerate?: boolean }` | `LecturerReportResponse`; ended only. `report.status` is `complete` or `failed` |

## Student endpoints

| Method & path | Body | Response |
| --- | --- | --- |
| `GET /api/join/:code` | – | `{ lecture: JoinPreview }` for QR links / pre-join screen |
| `POST /api/join` | `{ code, displayName }` | `201 { lectureId, participant }` + cookie. Same browser rejoining returns `200` and the same participant |
| `GET /api/student/lectures/:id` | – | `StudentLectureState` (lecture, revealed slides, objectives, realtime channel) |
| `GET /api/student/lectures/:id/notes` | – | `{ notes: { content, updatedAt } }` |
| `PUT /api/student/lectures/:id/notes` | `{ content }` (≤100k chars) | `{ notes }` full-document save, last write wins |
| `GET /api/student/lectures/:id/annotations[?slide=n]` | – | `{ annotations: Annotation[] }` |
| `POST /api/student/lectures/:id/annotations` | `{ slideNumber, content, x?, y? }` (x/y are 0–1 pin position) | `201 { annotation }`; only revealed slides |
| `PATCH /api/student/lectures/:id/annotations/:aid` | `{ content?, x?, y? }` | `{ annotation }` |
| `DELETE /api/student/lectures/:id/annotations/:aid` | – | `204` |
| `POST /api/student/lectures/:id/confusion` | – | `201 ConfusionResponse` on the current slide. Live only. `429 cooldown` (30 s) |
| `GET /api/student/lectures/:id/questions` | – | `{ questions: StudentQuestion[] }` (own only) |
| `POST /api/student/lectures/:id/questions` | `{ body }` (≤1000 chars) | `201 { question }`. Live only. `429 rate_limited` (5/min) |
| `GET /api/student/lectures/:id/ai` | – | `{ messages: AiMessage[] }` private history |
| `POST /api/student/lectures/:id/ai` | `{ message }` (≤2000 chars) | `201 { messages: [studentMessage, assistantMessage] }`. `502 ai_failed` with `details.message` (the failed student message), `503 ai_unavailable`, `429` (10 per 5 min) |
| `GET /api/student/lectures/:id/recap` | – | `StudentRecapResponse` (`report` null until generated). Ended only |
| `POST /api/student/lectures/:id/recap` | `{ regenerate?: boolean }` | `StudentRecapResponse` with `report.status` `complete` or `failed` |
| `GET /api/student/lectures/:id/export` | – | `text/markdown` attachment of notes, annotations and questions |
| `GET /api/student/lectures/:id/voice` | – | `{ status, slideNumber, slideCount, summary }` current revealed slide (used by the voice agent's `get_current_slide` tool) |
| `POST /api/student/lectures/:id/voice` | – | `{ signedUrl, dynamicVariables }` starts a private ElevenLabs voice session. `503 voice_unavailable` without `ELEVENLABS_API_KEY`/`ELEVENLABS_AGENT_ID`, `502 voice_failed` if ElevenLabs refuses (the message names its HTTP status and error code, e.g. `401 missing_permissions`) |

### Join error codes

| Status | Code | Meaning |
| --- | --- | --- |
| 400 | `code_required` | Empty code |
| 400 | `invalid_code` | Not 6 characters from the join alphabet (no 0/O/1/I) |
| 404 | `code_not_found` | No lecture with that code |
| 409 | `lecture_not_open` | Lecture still in draft |
| 410 | `lecture_ended` | Lecture has ended |

QR codes should encode a student page URL containing the join code; that page calls
`GET /api/join/:code` then `POST /api/join`.

## AI behaviour

- Provider: Gemini REST API, enabled by `GEMINI_API_KEY` (`GEMINI_MODEL` defaults to Gemma 4 `gemma-4-26b-a4b-it`, sent with `thinkingLevel: "minimal"` for speed, configurable via `GEMINI_THINKING_LEVEL`; each request has a 55 s budget and transient 429/500/503 errors are retried once if time allows).
  Swap providers in `src/lib/ai/provider.ts`.
- Lecture AI context: lecture title/module/description, objectives, text of revealed slides,
  the current slide image, and the student's last 10 completed messages. Never other students' data.
- Report generation is synchronous and persisted in `ai_reports` with `pending`/`complete`/`failed`;
  a concurrent POST while one is pending returns the pending report.

## Realtime

Supabase Realtime **Broadcast** (no database replication). Subscribe with
`subscribeToChannel(channel, handlers, onStatus)` from `src/lib/realtime-client.ts`;
event payload types are in `src/lib/realtime.ts`. Events are best-effort hints: refetch the
REST state on (re)connect.

| Channel | Who | Events |
| --- | --- | --- |
| `lecture:<lectureId>` (from `StudentLectureState.realtime.channel`) | Students (and lecturer) | `lecture_state` `{ status, currentSlide, slideCount, startedAt, endedAt }` on open/start/slide change/end/slide reset; `slides_updated` `{ slideCount }`; `objectives_updated` `{}` |
| `lecture-host:<key>` (from `LecturerLecture.hostChannel`) | Lecturer only | `participant_joined` `{ displayName, joinedAt, participantCount }`; `confusion` `{ slideNumber, recentUniqueStudents, windowSeconds, participantCount, at }`; `question_created` `{ question }` |

On `lecture_state` or `slides_updated`, students should refetch `GET /api/student/lectures/:id`
to get newly revealed slide URLs.

## Voice tutor (ElevenLabs Agents)

Optional spoken Lecture AI on the student page (`src/components/student/voice-tutor.tsx`, `@elevenlabs/react`).
The server exchanges `ELEVENLABS_API_KEY` for a short-lived signed URL (`POST …/voice`); the key never
reaches the browser. The agent is configured in the ElevenLabs dashboard with authentication enabled and:

- Dynamic variables used in its prompt: `student_name`, `lecture_title`, `module`, `objectives`,
  `current_slide`, `slide_text`, `confused_slides` (all always provided).
- Client tools (executed in the student's browser through the normal student API, so the usual
  permission checks apply): `get_current_slide`, `mark_confused`, `ask_lecturer` (`question`),
  `save_note` (`text`). Logic lives in `src/lib/client/voice-tools.ts`.
