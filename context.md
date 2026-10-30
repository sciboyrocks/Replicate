# Replicate — project context

## Purpose and scope

Replicate is a local research workspace for repeated LLM answer-accuracy evaluation. A researcher supplies a question, reference answer and/or rubric, selects exact checkpoints, and requests N independent attempts per model. The user explicitly requested local operation: do not register, deploy, or host this app through Sites or another hosting service unless the user later requests it. Pushing source to GitHub does not change that runtime requirement.

## Architecture

- Next.js App Router with TypeScript and React; route handlers are the backend. No Python service is required.
- `app/page.tsx`: dashboard, experiment setup, model catalog, results, attempt review, history, and methodology.
- `app/globals.css`: responsive styling.
- `app/api/[...path]/route.ts`: catalog, experiment creation/history/detail, cancellation, resume, overrides, and downloads.
- `lib/models.ts` and `lib/catalog.ts`: exact checkpoint catalog and live provider discovery.
- `lib/providers.ts`: OpenRouter, Hugging Face, Cloudflare, Ollama, vLLM, and demo adapters; separate semantic judge requests.
- `lib/runner.ts`: process-local concurrency, fresh trials, transport retries, cancellation, and recovery.
- `lib/store.ts`: queued atomic writes of experiment snapshots to `data/<uuid>.json`.
- `lib/grading.ts`: strict/normalized/numeric grading, summaries, and 95% Wilson intervals.
- `lib/export.ts`: full JSON and spreadsheet-safe CSV, including per-model statistics.
- `lib/schema.ts`: server-side input validation with Zod.

## Research invariants

1. Each statistical trial is a fresh inference request containing only one user message with the question. Never send the reference, rubric, earlier responses, or judge feedback to the tested model.
2. N means planned statistical attempts per model. Transport retries are logged inside the existing trial and never increase N. Retry only connection/timeouts, HTTP 408/429/5xx; keep permanent errors visible.
3. Resume retains completed trials. A saved candidate answer must be reused if its semantic judge failed. External requests cannot guarantee exactly-once billing across crashes.
4. Never silently substitute another checkpoint, size, or generation. OLMo Instruct and Think are distinct selections. Local mappings are explicit researcher attestations and require actual weight/precision/revision verification.
5. Only offer a reasoning toggle for a verified provider route and implemented wire protocol. Currently that is OpenRouter optional-reasoning metadata with `reasoning.enabled`. Hiding reasoning is not disabling it. Local/HF toggles remain unavailable.
6. Record actual route/model IDs, returned provider/model, available canonical version, precision, sampling settings, raw responses, usage, and grade decisions. Unknown metadata stays unknown.
7. Correct / N uses planned N. Accuracy and Wilson confidence intervals use graded trials only, with errors and ungraded trials visible. Within-question repetition does not establish general benchmark performance or true independent sampling.
8. Manual review requires a reason and preserves the automatic verdict. Demo results are explicitly simulated and never evidence of actual model performance.
9. Credentials stay in server-side environment variables. Never expose them through client code, logs, exports, or committed files.

## Checkpoints and provider status

The catalog contains eight primary checkpoints plus two variants of the OLMo 3 7B audit model:

- `meta-llama/Llama-3.2-3B-Instruct`
- `meta-llama/Llama-3.1-8B-Instruct`
- `Qwen/Qwen3.5-4B`, `Qwen/Qwen3.5-9B`, `Qwen/Qwen3.5-27B`
- `Qwen/Qwen3-14B`
- `google/gemma-4-12B-it`, `google/gemma-4-31B-it`
- `allenai/Olmo-3-7B-Instruct`, `allenai/Olmo-3-7B-Think`

The dated audit is in `PROVIDERS.md` and `lib/research.json`; runtime evidence is in `validation/catalog.json`. Findings were checked on 31 October 2026 and must be refreshed before relying on availability or quotas.

- OpenRouter: exact `google/gemma-4-31b-it:free` route verified publicly; other matching routes are paid. Do not use random `openrouter/free` routing. Free-tier request limits and capacity apply.
- Cloudflare: Llama 3.2 3B free allocation; Llama 3.1 8B route explicitly uses FP8. Free allocation is shared and paid accounts can incur overages.
- HF: paid/credit-backed live mappings add exact coverage, including Qwen3.5 4B. No recurring included credits for free accounts were advertised in the checked pricing.
- OLMo Instruct's Hub page advertised Public AI, but its live mapping returned `status: error`; the app excludes it. Gemma4 12B and OLMo Think had no eligible integrated hosted route.
- Groq's requested Llama was Enterprise; Cerebras/direct Gemini had no verified exact requested shared route.

Seven checkpoint variants had eligible integrated hosted routes in the saved catalog. A public listing, configured credential, and successful authenticated completion are different claims. No authenticated hosted completions were performed during implementation because credentials were not supplied.

## Run and validate

Use Node.js 22 LTS or newer. The implementation was tested with Node 26.5.0.

```sh
npm ci
npm run dev
# Open http://127.0.0.1:3000
```

For a stable local session:

```sh
npm run build
npm start
```

Copy `.env.example` to `.env.local` for real providers. Exact steps and optional local-engine mappings are in `README.md`. No keys are needed for Demo. Use one server process per data directory; keep the process running while trials execute.

Validation commands:

```sh
npm run typecheck
npm test
npm run build
# With the local server running:
node scripts/smoke.mjs
```

The previous validation passed 16 core tests, 9 HTTP checks, TypeScript, and production build. `validation/VALIDATION.md` documents coverage and limits. Core hosted calls are mocked. HTTP smoke tests run real demo trials and create named validation experiments in local history. Browser automation was disabled, so screenshots and visual interaction QA were not performed or claimed.

## Persistence, boundaries, and maintenance

- `data/` is local researcher data; `.env*` may contain secrets. Both are excluded from Git, except the placeholder-only `.env.example`.
- `node_modules/`, `.next/`, Next.js type declarations, TypeScript caches, and OS metadata are generated and excluded.
- `validation/` intentionally contains synthetic test logs and public catalog evidence, not private experiment data or credentials.
- Background execution uses a process-local map, not a durable worker service. Reopened running records become interrupted after a server restart and can resume.
- The tool is single-user and loopback-only, with no multi-user authentication. Do not expose it to a network or run multiple servers against one data directory.
- Quota introspection, immutable remote weight verification, local reasoning toggles, browser screenshot QA, and authenticated provider validation remain limitations.
- Large N and histories can consume substantial memory/disk. Provider caching, unknown precision, revisions, judge bias, and failed-call billing limit research interpretation.
- Read `AGENTS.md` and the relevant installed Next.js guides before changing framework behavior. Keep README/provider claims aligned with current source and verification evidence.
