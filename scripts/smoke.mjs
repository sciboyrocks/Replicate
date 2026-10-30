import assert from "node:assert/strict";
import fs from "node:fs/promises";
const origin = process.env.APP_URL || "http://127.0.0.1:3000";
const checks = [];
const record = (s) => {
  checks.push(s);
  console.log("PASS", s);
};
async function api(path, body) {
  const r = await fetch(origin + "/api/" + path, {
    ...(body === undefined
      ? {}
      : {
          method: "POST",
          headers: { "Content-Type": "application/json", Origin: origin },
          body: JSON.stringify(body),
        }),
  });
  const data = await r.json();
  assert.ok(r.ok, JSON.stringify(data));
  return data;
}
const page = await fetch(origin);
assert.equal(page.status, 200);
const html = await page.text();
for (const text of [
  "A better answer starts with evidence.",
  "Define your question",
  "Select your models",
  "Set the protocol",
])
  assert.ok(html.includes(text));
record("Dashboard renders all primary setup sections over HTTP");
const config = {
  title: "Validation · independent trials",
  question: "What is 6 × 7? Answer with only the number.",
  reference: "42",
  rubric: "Answer 42.",
  grading: "numeric",
  tolerance: 0,
  relativeTolerance: 0,
  models: ["llama32", "gemma431"],
  n: 5,
  mode: "demo",
  temperature: 0.7,
  topP: 0.95,
  seed: 42,
  maxTokens: 128,
  concurrency: 2,
  retries: 2,
  reasoning: "default",
  allowPaid: false,
  judgeModel: "google/gemma-4-31b-it:free",
  judgeProvider: "openrouter",
};
const experiment = await api("experiments", config);
assert.equal(experiment.attempts.length, 10);
record("Create API plans exactly N × models trials");
async function settled(id) {
  for (let i = 0; i < 120; i++) {
    const e = await api("experiments/" + id);
    if (e.status !== "running") return e;
    await new Promise((r) => setTimeout(r, 100));
  }
  throw Error("Run timed out");
}
let e = await settled(experiment.id);
assert.equal(e.status, "completed");
assert.equal(e.attempts.filter((a) => a.grade.correct).length, 8);
for (const a of e.attempts) {
  assert.equal(a.transports.length, 1);
  assert.deepEqual(a.response.messages, [
    { role: "user", content: config.question },
  ]);
  assert.equal(a.response.simulated, true);
}
record(
  "Ten independent demo calls complete with expected 8/10 numeric grades and no hidden context",
);
const target = e.attempts.find((a) => !a.grade.correct);
e = await api(`experiments/${e.id}/override`, {
  attemptId: target.id,
  correct: true,
  reason: "API validation override",
});
assert.equal(e.attempts.find((a) => a.id === target.id).grade.correct, false);
assert.equal(e.attempts.find((a) => a.id === target.id).override.correct, true);
record("Manual override preserves the automatic verdict and audit reason");
for (const format of ["csv", "json"]) {
  const r = await fetch(
    `${origin}/api/experiments/${e.id}/export?format=${format}`,
  );
  assert.equal(r.status, 200);
  assert.ok(r.headers.get("content-disposition").includes("." + format));
  const text = await r.text();
  if (format === "json") assert.equal(JSON.parse(text).attempts.length, 10);
  else assert.equal(text.split("\r\n").length, 11);
}
record("CSV and JSON downloads contain every trial");
const run = await api("experiments", {
  ...config,
  title: "Validation · cancellation and recovery",
  n: 12,
  concurrency: 1,
});
await new Promise((r) => setTimeout(r, 280));
const cancelled = await api(`experiments/${run.id}/cancel`, {});
assert.equal(cancelled.status, "cancelled");
assert.ok(cancelled.attempts.some((a) => a.status === "cancelled"));
const before = cancelled.attempts
  .filter((a) => a.status === "done")
  .map((a) => a.response);
await api(`experiments/${run.id}/resume`, {});
const resumed = await settled(run.id);
assert.equal(resumed.status, "completed");
assert.equal(resumed.attempts.length, 24);
for (let i = 0; i < before.length; i++)
  assert.deepEqual(resumed.attempts[i].response, before[i]);
record(
  "Cancel aborts outstanding trials; resume completes only remaining slots and retains responses",
);
const history = await api("experiments");
assert.ok(history.some((h) => h.id === e.id));
record("Experiment history persists completed runs");
const rejection = await fetch(origin + "/api/experiments", {
  method: "POST",
  headers: {
    "Content-Type": "application/json",
    Origin: "https://untrusted.example",
  },
  body: JSON.stringify(config),
});
assert.equal(rejection.status, 403);
record("Cross-origin writes are rejected");
const invalid = await fetch(origin + "/api/experiments", {
  method: "POST",
  headers: { "Content-Type": "application/json", Origin: origin },
  body: JSON.stringify({ ...config, n: 0 }),
});
assert.equal(invalid.status, 400);
record("Invalid trial counts are rejected server-side");
await fs.mkdir("validation", { recursive: true });
await fs.writeFile(
  "validation/http-results.json",
  JSON.stringify(
    {
      at: new Date().toISOString(),
      url: origin,
      checks,
      experimentIds: [e.id, run.id],
    },
    null,
    2,
  ),
);
console.log(`${checks.length} HTTP checks passed.`);
