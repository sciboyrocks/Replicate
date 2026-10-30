import { randomUUID } from "node:crypto";
import { read, write, list } from "./store";
import { grade } from "./grading";
import { infer, semantic, TransportError } from "./providers";
import type { Config, Experiment, Route } from "./types";
const state = globalThis as typeof globalThis & {
  labRuns?: Map<
    string,
    { exp: Experiment; controller: AbortController; finished?: Promise<void> }
  >;
};
const active: Map<
  string,
  { exp: Experiment; controller: AbortController; finished?: Promise<void> }
> = (state.labRuns ??= new Map<
  string,
  { exp: Experiment; controller: AbortController; finished?: Promise<void> }
>());
const now = () => new Date().toISOString();
async function backoff(e: TransportError, retry: number, signal: AbortSignal) {
  await new Promise<void>((resolve, reject) => {
    const abort = () => {
      clearTimeout(t);
      reject(Error("Cancelled"));
    };
    const t = setTimeout(
      () => {
        signal.removeEventListener("abort", abort);
        resolve();
      },
      Math.max(
        e.retryAfter,
        Math.min(30000, 1000 * 2 ** retry) + Math.random() * 500,
      ),
    );
    signal.addEventListener("abort", abort, { once: true });
  });
}
export async function get(id: string): Promise<Experiment> {
  const run = active.get(id);
  if (run) return run.exp;
  const e = await read(id);
  if (e.status === "running") {
    e.status = "interrupted";
    for (const a of e.attempts) if (a.status === "running") a.status = "queued";
    await write(e);
  }
  return e;
}
export async function history() {
  const all = await list();
  return Promise.all(all.map((e) => get(e.id)));
}
export async function create(config: Config) {
  const e: Experiment = {
    id: randomUUID(),
    createdAt: now(),
    updatedAt: now(),
    status: "running",
    config,
    attempts: config.models.flatMap((modelId) =>
      Array.from({ length: config.n }, (_, index) => ({
        id: randomUUID(),
        modelId,
        index,
        status: "queued" as const,
        transports: [],
      })),
    ),
  };
  await write(e);
  start(e);
  return e;
}
export async function resume(id: string) {
  if (active.has(id)) throw Error("Experiment is already running");
  const e = await get(id);
  if (e.status === "completed") throw Error("All trials are complete");
  for (const a of e.attempts)
    if (a.status !== "done") {
      a.status = "queued";
      a.error = undefined;
    }
  e.status = "running";
  await write(e);
  start(e);
  return e;
}
export async function cancel(id: string) {
  const run = active.get(id);
  if (run) {
    if (run.exp.status !== "running") return run.exp;
    run.exp.status = "cancelled";
    run.controller.abort();
    await run.finished;
    return run.exp;
  }
  const e = await get(id);
  if (e.status === "completed") return e;
  e.status = "cancelled";
  await write(e);
  return e;
}
export async function override(
  id: string,
  attemptId: string,
  correct: boolean,
  reason: string,
) {
  const e = await get(id);
  const a = e.attempts.find((x) => x.id === attemptId);
  if (!a || a.status !== "done") throw Error("Completed attempt required");
  a.override = { correct, reason, at: now() };
  e.updatedAt = now();
  await write(e);
  return e;
}
function start(exp: Experiment) {
  const controller = new AbortController();
  const handle: {
    exp: Experiment;
    controller: AbortController;
    finished?: Promise<void>;
  } = { exp, controller };
  active.set(exp.id, handle);
  handle.finished = run(exp, controller)
    .catch(async () => {
      exp.status = "failed";
      await write(exp).catch(() => {});
    })
    .finally(() => active.delete(exp.id));
}
async function run(exp: Experiment, controller: AbortController) {
  const c = exp.config,
    signal = controller.signal;
  let cursor = 0;
  const work = exp.attempts.filter((a) => a.status === "queued");
  async function worker() {
    while (cursor < work.length && !signal.aborted) {
      const a = work[cursor++];
      a.status = "running";
      a.startedAt = now();
      await write(exp);
      try {
        if (!a.response) {
          const routes: Route[] =
            c.mode === "demo"
              ? [
                  {
                    provider: "demo",
                    model: a.modelId,
                    free: true,
                    available: true,
                    reasoning: "none",
                    precision: "Simulated",
                  },
                ]
              : c.routes[a.modelId];
          let last: unknown;
          let succeeded = false;
          for (let retry = 0; retry <= c.retries; retry++) {
            const route = routes[retry % routes.length];
            const transport = {
              at: now(),
              provider: route.provider,
              model: route.model,
              phase: "inference" as const,
              error: undefined as string | undefined,
            };
            a.transports.push(transport);
            await write(exp);
            try {
              a.response = await infer(
                route,
                c.mode === "demo" ? { ...c, reasoning: "default" } : c,
                a.index,
                signal,
              );
              succeeded = true;
              await write(exp);
              break;
            } catch (e) {
              last = e;
              transport.error =
                e instanceof Error ? e.message : "Inference failed";
              await write(exp);
              if (
                signal.aborted ||
                !(e instanceof TransportError) ||
                !e.retryable
              )
                throw e;
              if (retry < c.retries) await backoff(e, retry, signal);
            }
          }
          if (!succeeded) throw last;
        }
        if (c.grading === "semantic") {
          if (c.mode === "demo")
            a.grade = {
              correct: null,
              reason:
                "Semantic judging is disabled in demo. Use a manual override or configure a live judge.",
            };
          else {
            for (let retry = 0; retry <= c.retries; retry++) {
              const transport = {
                at: now(),
                provider: c.judgeProvider,
                model: c.judgeModel,
                phase: "judge" as const,
                error: undefined as string | undefined,
              };
              a.transports.push(transport);
              await write(exp);
              try {
                a.grade = await semantic(a.response!, c, signal);
                break;
              } catch (e) {
                transport.error =
                  e instanceof Error ? e.message : "Judge failed";
                await write(exp);
                if (
                  signal.aborted ||
                  !(e instanceof TransportError) ||
                  !e.retryable ||
                  retry === c.retries
                )
                  throw e;
                await backoff(e, retry, signal);
              }
            }
          }
        } else a.grade = grade(a.response!.text, c);
        a.status = "done";
        a.completedAt = now();
      } catch (e) {
        a.status = signal.aborted ? "cancelled" : "error";
        a.error = e instanceof Error ? e.message : "Trial failed";
      }
      exp.updatedAt = now();
      await write(exp);
    }
  }
  await Promise.all(Array.from({ length: c.concurrency }, worker));
  if (signal.aborted) {
    exp.status = "cancelled";
    for (const a of exp.attempts)
      if (a.status === "queued") a.status = "cancelled";
  } else
    exp.status = exp.attempts.some((a) => a.status === "error")
      ? "failed"
      : "completed";
  exp.updatedAt = now();
  await write(exp);
}
