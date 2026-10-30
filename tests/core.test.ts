import test from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs/promises";
import os from "node:os";
import path from "node:path";
import { grade, normalize, summarize, wilson } from "../lib/grading";
import { infer, messagesFor, TransportError, semantic } from "../lib/providers";
import { configSchema } from "../lib/schema";
import { csv, experimentExport } from "../lib/export";
import type { Config, Route, Experiment } from "../lib/types";
const c: Config = {
  title: "test",
  question: "What is 2 + 2? Answer with a number only.",
  reference: "4",
  rubric: "The answer must be four.",
  grading: "normalized",
  tolerance: 0.01,
  relativeTolerance: 0,
  models: ["llama32", "gemma431"],
  n: 5,
  mode: "demo",
  temperature: 0.7,
  topP: 0.95,
  seed: 42,
  maxTokens: 100,
  concurrency: 2,
  retries: 2,
  reasoning: "default",
  allowPaid: false,
  judgeModel: "google/gemma-4-31b-it:free",
  judgeProvider: "openrouter",
  routes: {},
};
const route: Route = {
  provider: "openrouter",
  model: "test/exact-checkpoint:free",
  available: true,
  free: true,
  reasoning: "toggle",
  precision: "unknown",
  promptPrice: 0,
  completionPrice: 0,
};
const response = (text = "4") =>
  new Response(
    JSON.stringify({
      id: "request1",
      model: "test/exact-checkpoint",
      provider: "Test upstream",
      choices: [{ message: { content: text }, finish_reason: "stop" }],
      usage: { prompt_tokens: 12, completion_tokens: 1 },
    }),
    { status: 200 },
  );
test("normalized grading preserves punctuation and applies Unicode normalization", () => {
  assert.equal(normalize("  ＡNSWER\n here "), "answer here");
  assert.equal(grade(" FOUR  ", { ...c, reference: "four" }).correct, true);
  assert.equal(grade("four.", { ...c, reference: "four" }).correct, false);
  assert.equal(grade("4 ", { ...c, grading: "exact" }).correct, false);
});
test("numeric grading accepts only finite standalone numbers and both tolerance types", () => {
  const n = {
    ...c,
    grading: "numeric" as const,
    reference: "100",
    tolerance: 0.1,
    relativeTolerance: 0.01,
  };
  assert.equal(grade("101", n).correct, true);
  assert.equal(grade("101.01", n).correct, false);
  assert.equal(grade("100 meters", n).correct, false);
  assert.equal(grade("Infinity", n).correct, false);
  assert.equal(grade("1e2", n).correct, true);
});
test("Wilson intervals known values, empty and extreme outcomes", () => {
  assert.equal(wilson(0, 0), null);
  const ci = wilson(5, 10)!;
  assert.ok(Math.abs(ci[0] - 0.236593) < 0.00001);
  assert.ok(Math.abs(ci[1] - 0.763407) < 0.00001);
  assert.ok(wilson(0, 10)![0] >= 0);
  assert.ok(wilson(10, 10)![1] <= 1);
});
test("schema rejects missing gold, invalid counts, unsafe settings; allows rubric-only judging", () => {
  assert.equal(configSchema.safeParse({ ...c, n: 0 }).success, false);
  assert.equal(
    configSchema.safeParse({ ...c, concurrency: 99 }).success,
    false,
  );
  assert.equal(configSchema.safeParse({ ...c, reference: "" }).success, false);
  assert.equal(
    configSchema.safeParse({
      ...c,
      grading: "semantic",
      reference: "",
      rubric: "Correct reasoning",
    }).success,
    true,
  );
});
test("fresh requests contain one question and never leak gold, rubric, or previous answers", async () => {
  const old = globalThis.fetch;
  const calls: any[] = [];
  globalThis.fetch = async (_url, init) => {
    calls.push(JSON.parse(String(init?.body)));
    return response();
  };
  try {
    await infer(route, c, 0, new AbortController().signal);
    await infer(route, c, 1, new AbortController().signal);
    assert.equal(calls.length, 2);
    for (const call of calls) {
      assert.deepEqual(call.messages, messagesFor(c));
      assert.equal(call.messages.length, 1);
      assert.equal(call.max_tokens, 100);
      assert.equal(call.provider.require_parameters, true);
    }
    assert.equal(calls[0].seed, 42);
    assert.equal(calls[1].seed, 43);
    assert.equal(JSON.stringify(calls).includes(c.rubric), false);
    assert.deepEqual(calls[0].messages, calls[1].messages);
  } finally {
    globalThis.fetch = old;
  }
});
test("reasoning toggle changes actual supported provider parameter and rejects unsupported route", async () => {
  const old = globalThis.fetch;
  let sent: any;
  globalThis.fetch = async (_url, init) => {
    sent = JSON.parse(String(init?.body));
    return response();
  };
  try {
    await infer(
      route,
      { ...c, reasoning: "off" },
      0,
      new AbortController().signal,
    );
    assert.deepEqual(sent.reasoning, { enabled: false });
    await assert.rejects(
      () =>
        infer(
          { ...route, reasoning: "unknown" },
          { ...c, reasoning: "on" },
          0,
          new AbortController().signal,
        ),
      /no verified reasoning toggle/,
    );
  } finally {
    globalThis.fetch = old;
  }
});
test("provider error classification separates rate/transport errors from permanent errors", async () => {
  const old = globalThis.fetch;
  try {
    globalThis.fetch = async () =>
      new Response("", { status: 429, headers: { "retry-after": "2" } });
    await assert.rejects(
      () => infer(route, c, 0, new AbortController().signal),
      (e) =>
        e instanceof TransportError && e.retryable && e.retryAfter === 2000,
    );
    globalThis.fetch = async () => new Response("", { status: 401 });
    await assert.rejects(
      () => infer(route, c, 0, new AbortController().signal),
      (e) => e instanceof TransportError && !e.retryable,
    );
  } finally {
    globalThis.fetch = old;
  }
});
test("semantic judge records usage and treats invalid JSON as ungraded", async () => {
  const old = globalThis.fetch;
  try {
    globalThis.fetch = async () =>
      response('{"correct":true,"reason":"Matches the rubric"}');
    const answer = await infer(route, c, 0, new AbortController().signal);
    const verdict = await semantic(answer, c, new AbortController().signal);
    assert.equal(verdict.correct, true);
    assert.equal(verdict.judge.usage.prompt, 12);
    globalThis.fetch = async () => response("not JSON");
    assert.equal(
      (await semantic(answer, c, new AbortController().signal)).correct,
      null,
    );
  } finally {
    globalThis.fetch = old;
  }
});
test("runner executes exact trial count, persists, applies overrides, and exports safely", async () => {
  process.env.DATA_DIR = await fs.mkdtemp(
    path.join(os.tmpdir(), "replicate-tests-"),
  );
  const runner = await import("../lib/runner");
  const e = await runner.create(c);
  let final = await runner.get(e.id);
  for (let i = 0; i < 100 && final.status === "running"; i++) {
    await new Promise((r) => setTimeout(r, 40));
    final = await runner.get(e.id);
  }
  assert.equal(final.status, "completed");
  assert.equal(final.attempts.length, 10);
  assert.equal(final.attempts.filter((a) => a.status === "done").length, 10);
  assert.equal(final.attempts.flatMap((a) => a.transports).length, 10);
  for (const a of final.attempts)
    assert.deepEqual(a.response!.messages, messagesFor(c));
  const s = summarize(final.attempts, 10);
  assert.equal(s.correct, 8);
  assert.equal(s.accuracy, 0.8);
  const target = final.attempts.find((a) => a.grade?.correct === false)!;
  final = await runner.override(e.id, target.id, true, "Valid alternative");
  assert.equal(summarize(final.attempts, 10).correct, 9);
  assert.equal(
    final.attempts.find((a) => a.id === target.id)!.grade!.correct,
    false,
  );
  assert.equal((await runner.history()).length, 1);
  const raw = JSON.parse(
    await fs.readFile(path.join(process.env.DATA_DIR, e.id + ".json"), "utf8"),
  );
  assert.equal(raw.attempts.length, 10);
  final.attempts.find((a) => a.id === target.id)!.response!.text =
    '=HYPERLINK("evil")';
  const output = csv(final);
  assert.ok(output.includes("'=HYPERLINK"));
  assert.ok(output.includes("automatic_correct"));
  assert.equal(experimentExport(final).summary.overall.correct, 9);
  assert.ok(output.includes("model_ci95_lower_fraction"));
});
test("cancellation and resume preserve completed attempts and complete only remaining N", async () => {
  const runner = await import("../lib/runner");
  const e = await runner.create({ ...c, n: 8, concurrency: 1 });
  await new Promise((r) => setTimeout(r, 260));
  await runner.cancel(e.id);
  let f = await runner.get(e.id);
  for (
    let i = 0;
    i < 50 && f.attempts.some((a) => a.status === "running");
    i++
  ) {
    await new Promise((r) => setTimeout(r, 30));
    f = await runner.get(e.id);
  }
  await new Promise((r) => setTimeout(r, 50));
  f = await runner.get(e.id);
  assert.equal(f.status, "cancelled");
  const completed = f.attempts
    .filter((a) => a.status === "done")
    .map((a) => ({ id: a.id, response: JSON.stringify(a.response) }));
  assert.ok(completed.length >= 1);
  await runner.resume(e.id);
  for (let i = 0; i < 200; i++) {
    f = await runner.get(e.id);
    if (f.status !== "running") break;
    await new Promise((r) => setTimeout(r, 50));
  }
  assert.equal(f.status, "completed");
  assert.equal(f.attempts.length, 16);
  for (const done of completed)
    assert.equal(
      JSON.stringify(f.attempts.find((a) => a.id === done.id)!.response),
      done.response,
    );
});
test("transient network retry stays inside N and failover preserves exact route model", async () => {
  const runner = await import("../lib/runner");
  const old = globalThis.fetch;
  const requests: any[] = [];
  let i = 0;
  globalThis.fetch = async (_url, init) => {
    requests.push(JSON.parse(String(init?.body)));
    return i++ === 0 ? new Response("", { status: 429 }) : response();
  };
  try {
    const e = await runner.create({
      ...c,
      mode: "live",
      n: 1,
      models: ["llama32"],
      routes: { llama32: [route] },
      concurrency: 1,
    });
    let f = await runner.get(e.id);
    for (let i = 0; i < 150 && f.status === "running"; i++) {
      await new Promise((r) => setTimeout(r, 30));
      f = await runner.get(e.id);
    }
    assert.equal(f.status, "completed");
    assert.equal(f.attempts.length, 1);
    assert.equal(f.attempts[0].transports.length, 2);
    assert.ok(f.attempts[0].transports[0].error);
    assert.equal(requests[0].model, requests[1].model);
    assert.deepEqual(requests[0].messages, requests[1].messages);
  } finally {
    globalThis.fetch = old;
  }
});
test("judge failure and resume never regenerate an already saved candidate response", async () => {
  const runner = await import("../lib/runner");
  const old = globalThis.fetch;
  let inferenceCalls = 0,
    judgeCalls = 0,
    failJudge = true;
  globalThis.fetch = async (_url, init) => {
    const body = JSON.parse(String(init?.body));
    if (body.messages[0].content === c.question) {
      inferenceCalls++;
      return response("4");
    }
    judgeCalls++;
    if (failJudge) return new Response("", { status: 401 });
    return response('{"correct":true,"reason":"Correct number"}');
  };
  try {
    const e = await runner.create({
      ...c,
      mode: "live",
      grading: "semantic",
      models: ["llama32"],
      n: 1,
      routes: { llama32: [route] },
      concurrency: 1,
    });
    let f = await runner.get(e.id);
    for (let i = 0; i < 100 && f.status === "running"; i++) {
      await new Promise((r) => setTimeout(r, 20));
      f = await runner.get(e.id);
    }
    assert.equal(f.status, "failed");
    assert.equal(f.attempts[0].response?.text, "4");
    assert.equal(inferenceCalls, 1);
    failJudge = false;
    await runner.resume(e.id);
    for (let i = 0; i < 100; i++) {
      f = await runner.get(e.id);
      if (f.status !== "running") break;
      await new Promise((r) => setTimeout(r, 20));
    }
    assert.equal(f.status, "completed");
    assert.equal(inferenceCalls, 1);
    assert.equal(judgeCalls, 2);
    assert.equal(
      f.attempts[0].transports.filter((t) => t.phase === "judge").length,
      2,
    );
  } finally {
    globalThis.fetch = old;
  }
});
test("missing grades and errors stay out of the graded denominator", () => {
  const attempts: any[] = [
    {
      status: "done",
      grade: { correct: true },
      response: {
        latency: 100,
        usage: { prompt: null, completion: null, cost: null },
      },
    },
    {
      status: "done",
      grade: { correct: null },
      response: { latency: 200, usage: { prompt: 1, completion: 2, cost: 0 } },
    },
    { status: "error" },
  ];
  const s = summarize(attempts, 3);
  assert.equal(s.n, 3);
  assert.equal(s.correct, 1);
  assert.equal(s.judged, 1);
  assert.equal(s.accuracy, 1);
  assert.equal(s.errors, 1);
  assert.equal(s.tokens, null);
  assert.equal(s.cost, null);
});
test("reopening persisted running state marks interruption without losing the saved response", async () => {
  const runner = await import("../lib/runner");
  const store = await import("../lib/store");
  const { randomUUID } = await import("node:crypto");
  const id = randomUUID();
  const saved = await infer(
    {
      provider: "demo",
      model: "llama32",
      available: true,
      free: true,
      reasoning: "none",
      precision: "simulated",
    },
    c,
    0,
    new AbortController().signal,
  );
  const e: Experiment = {
    id,
    createdAt: new Date().toISOString(),
    updatedAt: new Date().toISOString(),
    status: "running",
    config: { ...c, n: 1, models: ["llama32"] },
    attempts: [
      {
        id: randomUUID(),
        modelId: "llama32",
        index: 0,
        status: "running",
        response: saved,
        transports: [],
      },
    ],
  };
  await store.write(e);
  const reopened = await runner.get(id);
  assert.equal(reopened.status, "interrupted");
  assert.equal(reopened.attempts[0].status, "queued");
  assert.deepEqual(reopened.attempts[0].response, saved);
});

test("Cloudflare and local adapters use their actual wire protocols and preserve model identity", async () => {
  const old = globalThis.fetch;
  const requests: { url: string; body: any }[] = [];
  globalThis.fetch = async (url, init) => {
    const body = JSON.parse(String(init?.body));
    requests.push({ url: String(url), body });
    if (String(url).includes("cloudflare"))
      return new Response(
        JSON.stringify({
          success: true,
          result: {
            response: "4",
            usage: { prompt_tokens: 5, completion_tokens: 1 },
          },
        }),
      );
    if (String(url).endsWith("/api/chat"))
      return new Response(
        JSON.stringify({
          model: body.model,
          message: { content: "4" },
          prompt_eval_count: 5,
          eval_count: 1,
          done_reason: "stop",
        }),
      );
    return response();
  };
  try {
    for (const provider of ["cloudflare", "ollama", "vllm"] as const) {
      const call = await infer(
        {
          ...route,
          provider,
          model:
            provider === "cloudflare"
              ? "@cf/meta/llama-3.2-3b-instruct"
              : "exact-local-alias",
          reasoning: "none",
        },
        c,
        0,
        new AbortController().signal,
      );
      assert.equal(call.text, "4");
      assert.equal(call.usage.completion, 1);
    }
    assert.ok(
      requests[0].url.endsWith("/ai/run/@cf/meta/llama-3.2-3b-instruct"),
    );
    assert.equal(requests[0].body.max_tokens, 100);
    assert.equal(requests[1].body.options.num_predict, 100);
    assert.equal(requests[1].body.model, "exact-local-alias");
    assert.equal(requests[2].body.max_tokens, 100);
    for (const r of requests) assert.deepEqual(r.body.messages, messagesFor(c));
  } finally {
    globalThis.fetch = old;
  }
});

test("catalog excludes lookalike checkpoints and non-live provider mappings", async () => {
  const old = globalThis.fetch;
  globalThis.fetch = async (url) => {
    if (String(url).includes("openrouter"))
      return new Response(
        JSON.stringify({
          data: [
            {
              id: "qwen/qwen3.5-4b-incorrect-suffix",
              pricing: { prompt: "0", completion: "0" },
            },
            {
              id: "google/gemma-4-31b-it:free",
              canonical_slug: "verified-version",
              pricing: { prompt: "0", completion: "0" },
              supported_parameters: ["reasoning", "max_tokens", "seed"],
              reasoning: { mandatory: false },
            },
          ],
        }),
      );
    return new Response(
      JSON.stringify({
        inferenceProviderMapping: {
          publicai: { status: "error", task: "conversational" },
        },
      }),
    );
  };
  try {
    const { catalog } = await import("../lib/catalog");
    const result = await catalog(true);
    assert.equal(
      result.models
        .find((m) => m.id === "qwen354")!
        .routes.filter((r) => r.provider === "openrouter").length,
      0,
    );
    const gemma = result.models
      .find((m) => m.id === "gemma431")!
      .routes.find((r) => r.provider === "openrouter")!;
    assert.equal(gemma.model, "google/gemma-4-31b-it:free");
    assert.equal(gemma.reasoning, "toggle");
    assert.equal(gemma.free, true);
    assert.ok(
      result.models.every(
        (m) => !m.routes.some((r) => r.provider === "huggingface"),
      ),
    );
    assert.ok(
      result.models.find((m) => m.id === "olmo")!.note?.includes("error"),
    );
  } finally {
    globalThis.fetch = old;
  }
});
