import type { Model, Route } from "./types";
import { base } from "./models";
const aliases: Record<string, string> = {
  llama32: "meta-llama/llama-3.2-3b-instruct",
  llama31: "meta-llama/llama-3.1-8b-instruct",
  qwen354: "qwen/qwen3.5-4b",
  qwen359: "qwen/qwen3.5-9b",
  qwen3527: "qwen/qwen3.5-27b",
  qwen314: "qwen/qwen3-14b",
  gemma412: "google/gemma-4-12b-it",
  gemma431: "google/gemma-4-31b-it",
  olmo: "allenai/olmo-3-7b-instruct",
  olmothink: "allenai/olmo-3-7b-think",
};
let cached:
  { at: number; data: Awaited<ReturnType<typeof refresh>> } | undefined;
async function json(url: string, headers: Record<string, string> = {}) {
  const r = await fetch(url, { headers, signal: AbortSignal.timeout(12000) });
  if (!r.ok) throw new Error(`Catalog HTTP ${r.status}`);
  return r.json();
}
async function refresh() {
  const errors: string[] = [];
  const models = structuredClone(base);
  let orModels: any[] = [];
  const hf = Promise.all(
    models.map(async (m) => {
      try {
        const card = await json(
          `https://huggingface.co/api/models/${m.checkpoint}?expand[]=inferenceProviderMapping`,
        );
        return { id: m.id, mapping: card.inferenceProviderMapping || {} };
      } catch {
        return { id: m.id, mapping: {}, error: true };
      }
    }),
  );
  try {
    const result = await json("https://openrouter.ai/api/v1/models");
    if (!Array.isArray(result.data)) throw Error("Malformed catalog");
    orModels = result.data;
  } catch {
    errors.push(
      "OpenRouter live catalog unavailable. No hosted routes inferred from cached claims.",
    );
  }
  let local: Record<
    string,
    {
      model: string;
      precision: string;
      revision?: string;
      reasoning?: Route["reasoning"];
    }
  > = {};
  try {
    local = JSON.parse(process.env.LOCAL_MODEL_MAP || "{}");
  } catch {
    errors.push("LOCAL_MODEL_MAP is invalid JSON");
  }
  const hfModels = await hf;
  if (hfModels.some((h) => h.error))
    errors.push(
      "Some Hugging Face coverage checks failed. Missing routes are not evidence that a checkpoint has no provider.",
    );
  for (const m of models) {
    // Checkpoint cards and provider routes are different claims. Mark official cards verified by committed research below.
    m.verified = true;
    for (const p of orModels.filter(
      (x) => x.id === aliases[m.id] || x.id === aliases[m.id] + ":free",
    )) {
      const params = p.supported_parameters || [];
      const reasoning = p.reasoning;
      const price = (v: unknown) =>
        (typeof v === "number" || (typeof v === "string" && v.trim() !== "")) &&
        Number.isFinite(Number(v))
          ? Number(v)
          : undefined;
      const promptPrice = price(p.pricing?.prompt),
        completionPrice = price(p.pricing?.completion);
      m.routes.push({
        provider: "openrouter",
        model: p.id,
        revision: p.canonical_slug,
        free: promptPrice === 0 && completionPrice === 0,
        available: !!process.env.OPENROUTER_API_KEY,
        reasoning: reasoning?.mandatory
          ? "always"
          : reasoning?.mandatory === false && params.includes("reasoning")
            ? "toggle"
            : "unknown",
        precision: "Provider undisclosed",
        maxTokens: p.top_provider?.max_completion_tokens,
        parameters: params,
        promptPrice,
        completionPrice,
      });
    }
    const mapping = hfModels.find((h) => h.id === m.id)?.mapping || {};
    const nonlive = (Object.entries(mapping) as [string, any][]).filter(
      ([, info]) => info.status !== "live",
    );
    if (nonlive.length)
      m.note = nonlive
        .map(
          ([provider, info]) =>
            `HF ${provider}: ${info.status}; excluded from runnable routes`,
        )
        .join(". ");
    for (const [provider, info] of Object.entries(mapping) as [string, any][]) {
      if (
        info.status === "live" &&
        ["conversational", "text-generation", "image-text-to-text"].includes(
          info.task,
        )
      )
        m.routes.push({
          provider: "huggingface",
          model: `${m.checkpoint}:${provider}`,
          free: false,
          available: !!process.env.HF_TOKEN,
          reasoning: "unknown",
          precision: "Provider undisclosed",
          parameters: ["temperature", "top_p", "seed", "max_tokens"],
        });
    }
    if (m.id === "llama32")
      m.routes.push({
        provider: "cloudflare",
        model: "@cf/meta/llama-3.2-3b-instruct",
        free: true,
        available: !!(
          process.env.CLOUDFLARE_API_TOKEN && process.env.CLOUDFLARE_ACCOUNT_ID
        ),
        reasoning: "none",
        precision: "Provider undisclosed",
        parameters: ["temperature", "top_p", "seed", "max_tokens"],
      });
    if (m.id === "llama31")
      m.routes.push({
        provider: "cloudflare",
        model: "@cf/meta/llama-3.1-8b-instruct-fp8",
        free: true,
        available: !!(
          process.env.CLOUDFLARE_API_TOKEN && process.env.CLOUDFLARE_ACCOUNT_ID
        ),
        reasoning: "none",
        precision: "FP8 · explicit quantized variant",
        parameters: ["temperature", "top_p", "seed", "max_tokens"],
      });
    if (local[m.id])
      for (const provider of ["ollama", "vllm"] as const) {
        if (
          process.env[
            provider === "ollama" ? "OLLAMA_BASE_URL" : "VLLM_BASE_URL"
          ]
        )
          m.routes.push({
            provider,
            model: local[m.id].model,
            precision: local[m.id].precision,
            revision: local[m.id].revision,
            free: true,
            available: true,
            reasoning: local[m.id].reasoning || "unknown",
            parameters: ["temperature", "top_p", "seed", "max_tokens"],
          });
      }
    m.routes.sort((a, b) => Number(b.free) - Number(a.free));
  }
  return {
    models,
    checkedAt: new Date().toISOString(),
    errors,
    credentials: {
      openrouter: !!process.env.OPENROUTER_API_KEY,
      huggingface: !!process.env.HF_TOKEN,
      cloudflare: !!process.env.CLOUDFLARE_API_TOKEN,
      ollama: !!process.env.OLLAMA_BASE_URL,
      vllm: !!process.env.VLLM_BASE_URL,
    },
  };
}
export async function catalog(force = false) {
  if (!force && cached && Date.now() - cached.at < 300000) return cached.data;
  const data = await refresh();
  cached = { at: Date.now(), data };
  return data;
}
