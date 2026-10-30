import type { Experiment } from "./types";
import { summarize } from "./grading";
export function experimentExport(e: Experiment) {
  return {
    ...e,
    summary: {
      overall: summarize(e.attempts, e.attempts.length),
      byModel: Object.fromEntries(
        e.config.models.map((id) => [
          id,
          summarize(
            e.attempts.filter((a) => a.modelId === id),
            e.config.n,
          ),
        ]),
      ),
    },
    exportedAt: new Date().toISOString(),
    statisticsNote:
      "Accuracy and 95% Wilson CI use graded trials; correct/N uses planned N. Demo is simulated. Failed calls may incur unreported costs.",
  };
}
export function csv(e: Experiment) {
  const summary = experimentExport(e).summary.byModel;
  const cols = [
    "experiment_id",
    "experiment_title",
    "mode",
    "catalog_model_id",
    "checkpoint",
    "model_correct",
    "model_planned_n",
    "model_graded_n",
    "model_accuracy_fraction",
    "model_ci95_lower_fraction",
    "model_ci95_upper_fraction",
    "trial",
    "status",
    "question",
    "reference",
    "rubric",
    "grading",
    "temperature",
    "top_p",
    "trial_seed",
    "max_tokens",
    "reasoning_mode",
    "correct",
    "automatic_correct",
    "override_reason",
    "response",
    "reasoning",
    "provider",
    "route_model",
    "returned_model",
    "revision",
    "precision",
    "latency_ms",
    "prompt_tokens",
    "completion_tokens",
    "cost_usd",
    "cost_source",
    "transport_calls",
    "error",
    "grading_reason",
    "judge_model",
    "judge_cost_usd",
  ];
  const cell = (v: unknown) => {
    let s = v == null ? "" : String(v);
    if (/^[=+\-@\t\r]/.test(s)) s = "'" + s;
    return '"' + s.replaceAll('"', '""') + '"';
  };
  return [
    cols,
    ...e.attempts.map((a) => [
      e.id,
      e.config.title,
      e.config.mode,
      a.modelId,
      e.config.modelsSnapshot?.find((m) => m.id === a.modelId)?.checkpoint ??
        a.modelId,
      summary[a.modelId].correct,
      summary[a.modelId].n,
      summary[a.modelId].judged,
      summary[a.modelId].accuracy,
      summary[a.modelId].ci?.[0],
      summary[a.modelId].ci?.[1],
      a.index + 1,
      a.status,
      e.config.question,
      e.config.reference,
      e.config.rubric,
      e.config.grading,
      e.config.temperature,
      e.config.topP,
      e.config.seed === null ? null : e.config.seed + a.index,
      e.config.maxTokens,
      e.config.reasoning,
      a.override?.correct ?? a.grade?.correct,
      a.grade?.correct,
      a.override?.reason,
      a.response?.text,
      a.response?.reasoning,
      a.response?.provider,
      a.response?.routeModel,
      a.response?.model,
      a.response?.revision,
      a.response?.precision,
      a.response?.latency,
      a.response?.usage.prompt,
      a.response?.usage.completion,
      a.response?.usage.cost,
      a.response?.usage.costSource,
      a.transports.length,
      a.error,
      a.grade?.reason,
      a.grade?.judge?.model,
      a.grade?.judge?.usage.cost,
    ]),
  ]
    .map((row) => row.map(cell).join(","))
    .join("\r\n");
}
