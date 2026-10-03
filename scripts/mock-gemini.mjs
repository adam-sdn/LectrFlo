// Minimal stand-in for the Gemini generateContent API, for scripts/smoke-test.mjs.
// Usage: node scripts/mock-gemini.mjs [port]   then set GEMINI_API_BASE_URL=http://localhost:<port>
// Answers by recognising the system prompt. GET /requests returns the received request bodies.

import { createServer } from "node:http";

const port = Number(process.argv[2] ?? 8787);
const requests = [];

function reply(body) {
  const system = body.systemInstruction?.parts?.[0]?.text ?? "";
  if (system.includes("learning objectives")) {
    return JSON.stringify({ objectives: ["Explain breadth-first search", "Compare BFS and DFS"] });
  }
  if (system.includes("post-lecture recap")) {
    return JSON.stringify({
      summary: "You covered graph traversal.",
      keyConcepts: [{ concept: "BFS", explanation: "Visits nodes level by level using a queue." }],
      objectivesReview: [{ objective: "Explain BFS", takeaway: "Queue-based traversal." }],
      struggledWith: [{ topic: "Queues in BFS", slideNumber: 2, suggestion: "Trace BFS on a small graph." }],
      followUp: ["Implement BFS on an adjacency list."],
    });
  }
  if (system.includes("insight report")) {
    return JSON.stringify({
      summary: "Students engaged well; slide 2 caused confusion.",
      confusionHotspots: [{ slideNumber: 2, likelyCause: "Queue ordering", suggestion: "Add a worked example." }],
      questionThemes: [{ theme: "Data structures", count: 1, exampleQuestions: ["Why a queue and not a stack?"] }],
      recommendations: ["Open next lecture with a BFS trace."],
    });
  }
  return "BFS explores neighbours first, using a queue so the oldest discovered node is expanded next.";
}

createServer((req, res) => {
  if (req.method === "GET" && req.url === "/requests") {
    res.writeHead(200, { "content-type": "application/json" });
    return res.end(JSON.stringify(requests));
  }
  let raw = "";
  req.on("data", (chunk) => (raw += chunk));
  req.on("end", () => {
    if (!req.url?.endsWith(":generateContent") || !req.headers["x-goog-api-key"]) {
      res.writeHead(400);
      return res.end();
    }
    const body = JSON.parse(raw);
    requests.push({ url: req.url, body });
    // MOCK_REJECT_THINKING=1 imitates models that don't accept thinkingConfig.
    if (process.env.MOCK_REJECT_THINKING && body.generationConfig?.thinkingConfig) {
      res.writeHead(400, { "content-type": "application/json" });
      return res.end(JSON.stringify({ error: { code: 400, message: "Thinking level is not supported for this model.", status: "INVALID_ARGUMENT" } }));
    }
    res.writeHead(200, { "content-type": "application/json" });
    res.end(JSON.stringify({ candidates: [{ content: { role: "model", parts: [{ text: reply(body) }] } }] }));
  });
}).listen(port, () => console.log(`mock gemini on :${port}`));
