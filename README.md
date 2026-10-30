# Replicate · local LLM research lab

A local Next.js + TypeScript application for repeated, fresh-context answer evaluation. No site registration, cloud database, or deployment is used. Next.js route handlers provide the backend, avoiding a second Python service.

Project architecture, research invariants, and handoff notes: [context.md](context.md).

## Start

Requirements: Node.js 22 LTS or newer and npm. Verified here with Node 26.5.0.

From this folder:

```sh
npm ci
npm run dev
```

Open **http://127.0.0.1:3000**. The server binds only to loopback. On macOS you can also double-click **Start Replicate.command**. Stop the terminal with Control-C.

For a stable local research session, use the production server:

```sh
npm run build
npm start
```

Run only one server process against a data directory. Keep that terminal running while experiments execute. Do not deploy this in a serverless environment: background tasks depend on the local Node process.

## First experiment, without credentials

1. Keep **Demo** selected in Experiment overview.
2. Enter a question and reference answer; choose grading, models, and attempts per model N.
3. Click **Run demo experiment**. Inspect model comparisons and individual responses in Results.
4. Click an attempt for raw output, metadata, transport history, and manual review. Enter an override reason before changing a verdict.
5. Download CSV or JSON. Run history reopens experiments saved on this computer.

Demo uses `demo/simulator-v1`, not the selected LLMs. It echoes the reference except for every fifth trial (trials 5, 10, …), which returns a known incorrect string. All outputs and exports are marked simulated; there is no inference charge. Semantic grading is deliberately ungraded in demo until manually reviewed. Demo is a workflow test, never model-performance evidence.

## Configure real providers

Copy `.env.example` to `.env.local`, fill only the provider(s) you want, and restart the server. Do not prefix credentials with `NEXT_PUBLIC_`. No credential entry or storage exists in the browser UI. The browser receives only configured/not-configured flags.

### OpenRouter — exact free Gemma route

1. Create an account and API key at [OpenRouter](https://openrouter.ai/settings/keys).
2. Set `OPENROUTER_API_KEY` in `.env.local`.
3. Open Model catalog and refresh live coverage. Select **Live providers**, Gemma 4 31B, and leave **Allow paid routes** unchecked.
4. Use a small first run, such as N=2, concurrency=1, 512–1024 output tokens. This is a real call, subject to account eligibility and provider capacity.

The integrated free route is `google/gemma-4-31b-it:free`; its public metadata was verified on 31 October 2026. The catalog and exact ID are checked at runtime. The app never uses `openrouter/free`, which can change models. Optional reasoning uses the actual `reasoning.enabled` field, only when the live model metadata marks reasoning optional, and sets `provider.require_parameters=true`. A supported switch is not proof that a provider's internal reasoning is observable.

OpenRouter also exposes paid exact routes for the Llamas, Qwen3.5 9B/27B, Qwen3 14B, and Gemma4 31B. They remain excluded unless you enable paid routes. Public catalog pricing is snapshotted; actual billed cost is preferred when returned. Failover stays within one catalog checkpoint and records each provider/route. OpenRouter can also fail over upstreams within the exact selected model ID. Precision is unknown unless explicitly supplied, and may vary between upstreams.

Free-model limits checked: 20 requests/minute, 50 requests/day without a qualifying purchase; purchasing $10 credits enables 1,000/day. Failed calls consume quota. Confirm current account limits before larger runs. See [free policy](https://openrouter.ai/collections/free-models).

### Cloudflare Workers AI — Llama free allocation

1. Create a Cloudflare account and find its account ID.
2. Create a scoped API token using the **Workers AI API Token** template (custom tokens need both **Workers AI / Read** and **Workers AI / Edit**) for the intended account, following the [REST setup](https://developers.cloudflare.com/workers-ai/get-started/rest-api/).
3. Set `CLOUDFLARE_ACCOUNT_ID` and `CLOUDFLARE_API_TOKEN` in `.env.local`; restart.
4. Select Llama 3.2 3B in live mode. Llama 3.1 8B is available through an **explicit FP8 quantized variant**, recorded as such in every result.

IDs: `@cf/meta/llama-3.2-3b-instruct` and `@cf/meta/llama-3.1-8b-instruct-fp8`. The 3B route does not disclose precision. Both use REST `/client/v4/accounts/{account}/ai/run/{model}` with one fresh user message. No Llama reasoning toggle is offered.

Allocation: 10,000 neurons/day, shared across account usage and reset at 00:00 UTC (05:30 IST). Default text-generation rate limit: 300 requests/minute. Workers Free rejects requests after allocation exhaustion; Workers Paid can bill overages. The app cannot inspect account quota or enforce an account-level spend cap. A route labelled free tier means an eligible allocation exists, not unlimited inference. [Pricing](https://developers.cloudflare.com/workers-ai/platform/pricing/) · [Limits](https://developers.cloudflare.com/workers-ai/platform/limits/).

### Hugging Face Inference Providers — extra exact coverage, paid/credits

Set `HF_TOKEN` to a fine-grained token with Inference Providers permission. Enable **Allow paid routes** in Advanced settings. The app queries each exact checkpoint's public `inferenceProviderMapping` and integrates only mappings marked live for a conversational/text-generation task. Requests use `https://router.huggingface.co/v1/chat/completions`, with `checkpoint:provider` to pin the upstream. Provider errors remain visible.

The live API confirmed extra coverage for Qwen3.5 4B via Featherless AI. Although the OLMo3 Instruct Hub page advertises Public AI, its live Public AI mapping returned status `error` during validation; the app does not add it from page text alone. Availability is checked rather than assumed from a Hub card. The app does not claim HF reasoning-toggle support; provider default is used. Some providers may reject or disregard particular sampling settings; verify behavior before a controlled study. Unreported price/token usage remains unknown.

HF free users currently receive **no included monthly credits**; PRO/Team plans include limited paid-plan credits. Public AI's direct $2 starter allowance is a trial and is not treated as an ongoing free tier or automatically integrated as a direct provider. [HF billing](https://huggingface.co/docs/inference-providers/en/pricing) · [Chat API](https://huggingface.co/docs/inference-providers/en/tasks/chat-completion).

### Other candidates and verified checkpoint list

[PROVIDERS.md](PROVIDERS.md) contains the dated, cited audit of all ten checkpoint variants, Groq, Cerebras, Google AI Studio, HF, Public AI, OpenRouter, and Cloudflare. Groq's requested Llama currently requires Enterprise access; no exact requested shared model was verified on Cerebras or the direct Gemini API. Nearby sizes and model generations are never substituted. Checkpoint existence, advertised hosting, configured credentials, and successful inference are distinct claims. **No authenticated hosted inference was performed during this build.**

## Local Ollama / vLLM adapters

Missing hosted models can use an explicitly mapped local server. Install and serve the actual requested weights using the engine's official instructions. Confirm license access and hardware requirements yourself; this app does not download or quantize weights. Quantization changes the experimental condition and must be recorded.

For Ollama, run its local service, then set:

```dotenv
OLLAMA_BASE_URL=http://127.0.0.1:11434
LOCAL_MODEL_MAP={"qwen354":{"model":"qwen3.5:4b","precision":"Q4_K_M","revision":"REPLACE_WITH_ACTUAL_INSTALLED_WEIGHT_DIGEST","reasoning":"unknown"}}
```

The model tag is an **illustration of configuration syntax**, not a verified guarantee that your Ollama installation has that exact tag or checkpoint. Use `ollama list` and `ollama show <actual-tag>` to verify the actual source weights, quantization, and template. Enter your actual model alias and digest. Do not map a Qwen3 or differently sized model to a Qwen3.5 catalog entry. Ollama requests use `/api/chat`, `stream:false`, and `options.num_predict` for the standardized output budget. Recordings show the standardized max_tokens plus the actual model alias and raw engine response.

For vLLM, serve the exact Hub checkpoint with a declared served-model-name and revision. For example, after installing a compatible vLLM version and required model dependencies:

```sh
vllm serve Qwen/Qwen3.5-4B --served-model-name qwen35-4b --host 127.0.0.1 --port 8000
```

Then set `VLLM_BASE_URL=http://127.0.0.1:8000/v1`, optional `VLLM_API_KEY`, and map `qwen354` to `qwen35-4b` with the real precision and weight revision. The serve command is engine/hardware dependent, not tested here. Only configure one local engine at a time unless both expose the same mapped aliases: LOCAL_MODEL_MAP applies to every configured local adapter. Mappings are an explicit researcher attestation, not automatic weight verification. Incorrect local mapping can invalidate a study.

Catalog IDs for mapping: `llama32`, `llama31`, `qwen354`, `qwen359`, `qwen3527`, `qwen314`, `gemma412`, `gemma431`, `olmo`, `olmothink`. OLMo Instruct and Think are separate checkpoints and separate selections. Local reasoning mode uses the installed chat-template default; on/off controls are deliberately unavailable until their wire protocol is implemented and verified. [Ollama API](https://docs.ollama.com/api/chat) · [vLLM OpenAI server](https://docs.vllm.ai/en/latest/serving/openai_compatible_server/).

## Experimental behavior

- **N independent contexts:** each model receives N separate requests, each containing only the question as one user message. No gold answer, rubric, earlier response, or judge feedback is fed into inference. Requests are independent in context; correlated provider RNG, deterministic outputs, caching, and queue effects remain possible.
- **Sampling:** temperature, top-p, output budget, and optional seed are fixed in the experiment snapshot. Trial index i uses base seed + i, consistently across models. The deterministic preset requests temperature=0, top-p=1, base seed=42; no reproducibility guarantee is implied. Reasoning can consume output tokens. A length finish reason is shown in attempt review.
- **Grading:** strict whole-response equality; normalized NFKC/lowercase/trim/whitespace-collapse equality (punctuation preserved); standalone numeric comparison using `error <= max(abs_tolerance, relative_tolerance * |reference|)`; or a separate semantic judge.
- **Semantic judging:** OpenRouter judge IDs must belong to the current research catalog; paid judges require paid-route opt-in. A configured local vLLM judge can use its served alias. Judge requests have temperature=0 and a separate 512-token budget. Candidate content is JSON-delimited and identified as untrusted data, but judge bias and prompt injection remain limitations. JSON with boolean correct and string reason is required. Invalid JSON remains ungraded. Judge response and usage are preserved. Human overrides require a reason and retain the automatic verdict.
- **Retries and failover:** only network/timeouts, HTTP 408/429/5xx retry; authentication, invalid inputs, and unsupported parameters fail visibly. Exponential backoff, jitter, and numeric Retry-After (capped at 60s) apply. Retries rotate compatible configured routes for the same checkpoint, with a separate transport log. Both inference and judge phases are labelled. Maximum retries apply per phase, per resume invocation, not to the statistical N. Provider-internal retries are not observable.
- **Cancellation/resume:** aborts active requests, marks remaining slots cancelled, and retains all saved responses. Resume fills only unfinished slots. If judging failed after inference, the saved response is reused. Process crashes are detected on reopening an experiment; active records become interrupted and can resume. A crash after provider execution but before saving can cause a duplicate billed request on resume; exactly-once external billing is not guaranteed.
- **Statistics:** correct / N uses planned trials; accuracy and 95% Wilson CI use graded trials only. Missing/errors/invalid judge outputs are excluded from accuracy and separately visible. For a complete run both denominators agree. Repeating one item measures within-item reliability, not population-level benchmark generalization. Deterministic/correlated outputs weaken binomial assumptions.
- **Usage:** successful inference and judge usage is recorded when returned. Provider-reported cost is preferred; OpenRouter catalog-based estimates are labelled. Missing tokens/cost are unknown. Local cost is zero API charges, excluding electricity/hardware. Failed/aborted calls may incur unreported costs; this is a usage record, not an invoice. Mean latency excludes backoff and judging; transport timestamps are exported.
- **Exports:** JSON includes aggregate model statistics/95% CIs, the full configuration, snapshotted model metadata, raw provider payloads, request controls, grades, overrides, and logs. CSV includes per-model statistics/95% CIs, prompt/reference/rubric, model/checkpoint/version/precision, trial settings, outputs, verdicts, latency, usage, and errors. CSV cells are quoted and formula-like prefixes are neutralized with an apostrophe. JSON retains exact text.

## Persistence and limits

Experiments are written atomically to `data/<uuid>.json` with file mode 0600. Keep backups of that folder. Draft inputs use local browser storage; clearing browser storage does not delete completed experiments. Closing the browser leaves the local server running; closing the server pauses execution. Catalog responses cache for five minutes. Failed catalog checks are reported and never replaced with guessed hosted routes. Public catalog fetches disclose no questions or credentials.

This is a single-user local research tool, not a multi-user service. One process owns an in-memory execution queue and atomically writes experiment snapshots. No authentication, shared worker queue, encrypted storage, automatic backup, or account quota introspection is supplied. Do not expose it to a network or run multiple processes against the same directory. Results include research prompts and references: protect exports appropriately. Model aliases/canonical slugs do not establish immutable weight versions; providers often hide precision. Maximum N=1,000 per model, concurrency=16, ten checkpoint variants, max output=32,768; practical free quotas are much smaller. Large response payloads and experiment histories can consume substantial memory/disk.

## Validation

```sh
npm run typecheck
npm test
npm run build
# With the local server running:
node scripts/smoke.mjs
```

Core tests use mocked hosted responses and real local persistence; they never spend API credits. HTTP smoke validation creates clearly named demo experiments in history. See [validation/VALIDATION.md](validation/VALIDATION.md) for results, verification boundaries, and the saved public catalog snapshot. Browser automation was unavailable in the authoring environment; no screenshot or visual browser check is claimed.
