import type { Attempt, Config, Grade } from "./types";
export const normalize = (s: string) =>
  s.normalize("NFKC").toLowerCase().trim().replace(/\s+/g, " ");
export function grade(
  text: string,
  c: Pick<Config, "grading" | "reference" | "tolerance" | "relativeTolerance">,
): Grade {
  if (c.grading === "semantic")
    return { correct: null, reason: "Awaiting semantic judge" };
  if (c.grading === "numeric") {
    const parse = (v: string) =>
      /^[+-]?(?:\d+(?:\.\d*)?|\.\d+)(?:e[+-]?\d+)?$/i.test(v.trim())
        ? Number(v)
        : NaN;
    const a = parse(text),
      b = parse(c.reference);
    if (!Number.isFinite(a) || !Number.isFinite(b))
      return {
        correct: false,
        reason: "Numeric grading requires a single finite number",
      };
    const delta = Math.abs(a - b),
      limit = Math.max(c.tolerance, c.relativeTolerance * Math.abs(b));
    return {
      correct: delta <= limit,
      reason: `Absolute error ${delta}; allowed ${limit}`,
    };
  }
  const correct =
    c.grading === "exact"
      ? text === c.reference
      : normalize(text) === normalize(c.reference);
  return {
    correct,
    reason:
      c.grading === "exact"
        ? "Case and whitespace sensitive exact match"
        : "NFKC, lowercase, trimmed and collapsed whitespace; punctuation preserved",
  };
}
export function wilson(k: number, n: number): [number, number] | null {
  if (!n) return null;
  const z = 1.95996398454,
    d = 1 + (z * z) / n,
    p = k / n,
    c = (p + (z * z) / (2 * n)) / d,
    h = (z * Math.sqrt((p * (1 - p)) / n + (z * z) / (4 * n * n))) / d;
  return [Math.max(0, c - h), Math.min(1, c + h)];
}
export function summarize(attempts: Attempt[], n: number) {
  const returned = attempts.filter((a) => a.response),
    done = attempts.filter((a) => a.status === "done"),
    judged = done.filter(
      (a) =>
        a.override ||
        (a.grade?.correct !== null && a.grade?.correct !== undefined),
    );
  const correct = judged.filter(
    (a) => a.override?.correct ?? a.grade?.correct,
  ).length;
  const known = (xs: (number | null | undefined)[]) =>
    xs.every((x) => x != null)
      ? xs.reduce<number>((s, x) => s + (x ?? 0), 0)
      : null;
  return {
    correct,
    n,
    completed: done.length,
    judged: judged.length,
    errors: attempts.filter((a) => a.status === "error").length,
    accuracy: judged.length ? correct / judged.length : null,
    ci: wilson(correct, judged.length),
    latency: returned.length
      ? returned.reduce((s, a) => s + (a.response?.latency ?? 0), 0) /
        returned.length
      : null,
    tokens: known(
      returned.flatMap((a) => [
        a.response?.usage.prompt,
        a.response?.usage.completion,
        ...(a.grade?.judge
          ? [a.grade.judge.usage.prompt, a.grade.judge.usage.completion]
          : []),
      ]),
    ),
    cost: known(
      returned.flatMap((a) => [
        a.response?.usage.cost,
        ...(a.grade?.judge ? [a.grade.judge.usage.cost] : []),
      ]),
    ),
  };
}
