# Provider and checkpoint audit

Checked 31 October 2026 against public first-party pages and public catalogs. This verifies advertised availability, not a successful authenticated inference call. Account eligibility, regional access, remaining quota, queues and upstream capacity must still be checked at run time. A Hub checkpoint alone does not imply a hosted API.

## Exact checkpoints and practical coverage

| Requested model | Verified checkpoint | Hosted evidence | Free finding |
|---|---|---|---|
| Llama 3.2 3B Instruct | `meta-llama/Llama-3.2-3B-Instruct` | Cloudflare `@cf/meta/llama-3.2-3b-instruct`; OpenRouter paid route | Cloudflare recurring allocation |
| Llama 3.1 8B Instruct | `meta-llama/Llama-3.1-8B-Instruct` | OpenRouter paid; Cloudflare FP8 route; Groq Enterprise | Cloudflare quantized variant must be disclosed |
| Qwen3.5 4B | `Qwen/Qwen3.5-4B` | Hub lists Featherless AI | No ongoing free exact route verified |
| Qwen3.5 9B | `Qwen/Qwen3.5-9B` | OpenRouter paid; Hub lists Together AI | No ongoing free exact route verified |
| Qwen3.5 27B | `Qwen/Qwen3.5-27B` | OpenRouter paid | No ongoing free exact route verified |
| Qwen3 14B | `Qwen/Qwen3-14B` | OpenRouter paid | No ongoing free exact route verified |
| Gemma 4 12B instruction tuned | `google/gemma-4-12B-it` | Hub explicitly reports no Inference Provider | Use local adapter unless a live exact route appears |
| Gemma 4 31B instruction tuned | `google/gemma-4-31B-it` | OpenRouter free and paid routes | `google/gemma-4-31b-it:free` verified in catalog |
| Olmo 3 7B Instruct audit | `allenai/Olmo-3-7B-Instruct` | Hub lists Public AI | Starter credit, not recurring free tier |
| Olmo 3 7B Think audit | `allenai/Olmo-3-7B-Think` | Hub explicitly reports no Inference Provider | Local adapter |

Checkpoint sources: [Llama 3.2](https://huggingface.co/meta-llama/Llama-3.2-3B-Instruct), [Llama 3.1](https://huggingface.co/meta-llama/Llama-3.1-8B-Instruct), [Qwen 4B](https://huggingface.co/Qwen/Qwen3.5-4B), [Qwen 9B](https://huggingface.co/Qwen/Qwen3.5-9B), [Qwen 27B](https://huggingface.co/Qwen/Qwen3.5-27B), [Qwen 14B](https://huggingface.co/Qwen/Qwen3-14B), [Gemma 12B](https://huggingface.co/google/gemma-4-12B-it), [Gemma 31B](https://huggingface.co/google/gemma-4-31B-it), [Olmo Instruct](https://huggingface.co/allenai/Olmo-3-7B-Instruct), [Olmo Think](https://huggingface.co/allenai/Olmo-3-7B-Think).

## Providers

**OpenRouter — genuine limited free variants.** Signup and API key required. Free `:free` models have 20 RPM and 50 requests/day; purchasing $10 credits raises the daily cap to 1,000 (higher cap threshold $9 after fees). Failed requests consume daily quota. Free capacity is opportunistic. Use an exact model ID; `openrouter/free` changes the model and is unsuitable for this experiment. Sources: [free-model policy](https://openrouter.ai/collections/free-models), [Gemma free route](https://openrouter.ai/google/gemma-4-31b-it:free).

The public catalog contains paid routes `meta-llama/llama-3.2-3b-instruct`, `meta-llama/llama-3.1-8b-instruct`, `qwen/qwen3.5-9b`, `qwen/qwen3.5-27b`, `qwen/qwen3-14b`, `google/gemma-4-31b-it`; no exact Qwen3.5 4B, Gemma4 12B or Olmo3 7B match was found. Record live canonical slug and metadata. Do not hard-code changing prices. [Catalog](https://openrouter.ai/api/v1/models).

Gemma31 free currently has one upstream, Google AI Studio, unknown precision, max output 32,768. It supports reasoning, seed, temperature, top_p, max_tokens. This is upstream metadata, not a direct Gemini API integration. [Exact free endpoints](https://openrouter.ai/api/v1/models/google/gemma-4-31b-it:free/endpoints).

**Cloudflare Workers AI — recurring free allocation.** Requires account ID and API token for REST; browser playground access is not equivalent to API access. 10,000 neurons/day shared allocation, reset 00:00 UTC; Free-plan requests fail after exhaustion. Default text generation limit 300 RPM. Llama3.2 3B supports max_tokens, temperature, top_p, seed (integer 1–9,999,999,999). Precision is not disclosed in that model's ID. Llama3.1 8B is explicitly FP8 (`@cf/meta/llama-3.1-8b-instruct-fp8`); keep it separate from precision-unknown routes. Sources: [pricing](https://developers.cloudflare.com/workers-ai/platform/pricing/), [limits](https://developers.cloudflare.com/workers-ai/platform/limits/), [3B schema](https://developers.cloudflare.com/workers-ai/models/llama-3.2-3b-instruct/), [8B FP8](https://developers.cloudflare.com/workers-ai/models/llama-3.1-8b-instruct-fp8/).

**Groq.** Requires signup/API key. Current official production table marks `llama-3.1-8b-instant` Enterprise with Contact Sales pricing and limits. The current Free-plan limit table omits it. Do not reuse historical 30 RPM/14,400 RPD claims for this checkpoint. Other Groq free models would be substitutions. Sources: [models](https://console.groq.com/docs/models), [rate limits](https://console.groq.com/docs/rate-limits).

**Hugging Face Inference Providers.** Requires HF account/token. Current pricing gives free users no included monthly credits; credit purchase or subscription is needed. PRO and Team/Enterprise receive $2 monthly credits. Coverage differs per exact checkpoint and upstream. No general recurring free API should be claimed. Sources: [pricing](https://huggingface.co/docs/inference-providers/en/pricing), checkpoint links above.

**Public AI.** Signup/API key; $2 new-account starter credit, then per-token pricing. Its OpenAI-compatible endpoint is `https://api.publicai.co/v1`; HF shows Olmo3 7B Instruct via this provider. Classify as trial credits. Source: [official developer portal](https://platform.publicai.co/docs).

**Cerebras.** Current shared catalog offers GPT-OSS120B and Qwen3.8 27B, with Free Trial/PAYG tiers. Neither is an exact match. No requested shared-hosted route verified; dedicated serving is separate. Source: [current catalog](https://inference-docs.cerebras.ai/models/overview).

**Google AI Studio / Gemini API.** Signup and API key; free tier is model/project dependent and exact quotas are displayed in AI Studio. Current direct API model catalog has no requested Gemma checkpoint. An OpenRouter upstream named Google AI Studio does not establish direct endpoint availability. Sources: [models](https://ai.google.dev/gemini-api/docs/models), [limits](https://ai.google.dev/gemini-api/docs/rate-limits).

## Reasoning and research controls

Only show provider-backed toggles. OpenRouter Gemma31, Qwen3.5 9B/27B and Qwen3 14B have optional reasoning metadata. Llama routes have none. `reasoning.exclude` hides returned reasoning but does not disable inference reasoning. Use `reasoning.enabled` only on optional reasoning routes and require parameter support in routing. Most providers count reasoning against the same max_tokens budget. [Reasoning API](https://openrouter.ai/docs/guides/best-practices/reasoning-tokens), [routing](https://openrouter.ai/docs/guides/routing/provider-selection).

Olmo Instruct and Think are different checkpoints; never implement a cosmetic toggle that swaps them without recording model identity. For local routes, configure the actual server chat template/parser, precision and revision explicitly. A fixed seed and zero temperature request reproducibility but do not guarantee identical outputs across provider hardware or revisions. Failover must preserve checkpoint and requested controls; record upstream and unknown precision honestly.

## Runtime cross-check

The implemented app queried the public OpenRouter catalog and each exact HF `inferenceProviderMapping` API on 31 October 2026. Seven of ten checkpoint variants had integrated hosted routes. Gemma4 12B, Olmo3 Instruct, and Olmo3 Think returned no eligible live mappings. Olmo Instruct's Public AI mapping explicitly returned `status: "error"`, so it was excluded. This differs from the Hub page's Public AI advertisement above. The app treats the live mapping as the gate and does not add that route based only on the page. See `validation/catalog.json` for the full timestamped snapshot, including Qwen4B Featherless coverage and model-specific reasoning metadata. No authenticated completion was attempted.

HF wire protocol sources: [chat completions](https://huggingface.co/docs/inference-providers/en/tasks/chat-completion), [Featherless](https://huggingface.co/docs/inference-providers/en/providers/featherless-ai), [PublicAI](https://huggingface.co/docs/inference-providers/en/providers/publicai).
