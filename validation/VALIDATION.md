# Validation record

Validated locally on 31 October 2026 (Asia/Kolkata). No website was registered or deployed.

| Check | Result |
|---|---|
| TypeScript | Passed, no errors |
| Core behavior | 16 tests passed |
| Production build | Passed |
| Local HTTP workflow | 9 checks passed |
| Public hosted catalog | Retrieved successfully; seven checkpoint variants with eligible integrated routes |
| Dependency audit | 0 known vulnerabilities at install-time audit |
| Authenticated hosted inference | Not performed; no API credentials supplied |
| Visual / browser screenshot QA | Not performed; local browser automation disabled in Work settings |

This report, test logs, and HTTP checks provide the requested equivalent validation in place of screenshots. It does not claim browser interaction or visual layout verification. Responsive styles are implemented for desktop, tablet, and mobile; visual behavior should be checked in your browser.

## Core logic coverage

The test suite checks:

1. Unicode/case/whitespace normalization with punctuation preserved.
2. Strict numeric parsing and absolute/relative tolerances.
3. Wilson intervals against known values and empty/extreme cases.
4. Server validation for missing references, invalid N, concurrency, and rubric-only judges.
5. Each inference has exactly one question message; gold/rubric/prior answers do not enter its context; per-trial seeds are distinct.
6. Supported reasoning toggles change the actual provider field, with unsupported routes rejected.
7. Retryable rate/network errors versus permanent authentication errors.
8. Semantic judge payloads, recorded usage, and invalid-output handling.
9. Exact N × models trial count, local file persistence, manual override audit, and spreadsheet-safe CSV escaping.
10. Cancellation/resume retains completed responses and fills only remaining trial slots.
11. Transport retries stay inside N and preserve the exact requested route model.
12. A saved candidate response survives judge failure and is reused on resume.
13. Errors/missing grades are excluded from graded accuracy while planned N remains visible.
14. Reopening an interrupted persisted run retains its saved response and marks unfinished work resumable.
15. Cloudflare, Ollama, and vLLM use the correct endpoints, output-budget fields, and model aliases.
16. Live catalogs exclude lookalike checkpoint IDs and non-live provider mappings.

Hosted responses are mocked in unit tests. Demo calls exercise the real runner, filesystem, concurrency, cancellation, and export implementations. Unit test data is isolated in temporary directories.

## HTTP validation

[http-results.json](http-results.json) records the successful checks and experiment IDs. The smoke script exercised the running Next.js server:

- Dashboard returned 200 with all setup sections.
- Creating two models × five trials produced exactly ten records.
- Independent simulated calls yielded the expected eight correct numeric answers out of ten.
- Manual override preserved the original automatic verdict.
- CSV and JSON exports contained all ten records.
- A separate 24-trial run cancelled and resumed without changing successful responses.
- Run history retained both records.
- Cross-origin writes returned 403.
- Invalid N returned 400.

The named validation experiments remain visible in local history. Their accuracy values are explicitly simulated and have no relationship to LLM performance.

## Live catalog findings

[catalog.json](catalog.json) is the timestamped runtime response from the public catalog integration. Credentials are represented only by presence booleans; no secrets or completion requests are included.

- OpenRouter advertised paid exact routes for both Llamas, Qwen3.5 9B/27B, Qwen3 14B, and Gemma4 31B, plus `google/gemma-4-31b-it:free`.
- The free Gemma route advertised optional reasoning. Its [exact endpoint metadata](https://openrouter.ai/api/v1/models/google/gemma-4-31b-it:free/endpoints) listed an unknown precision, 32,768 output tokens, and a Google AI Studio upstream. This is not a direct Gemini API integration.
- HF advertised Qwen3.5 4B through Featherless, plus several other exact paid mappings. Non-live mappings are excluded.
- OLMo Instruct's Public AI mapping had `status: error` on a follow-up API check. Its Hub page advertised a provider, but the runtime API did not make it an eligible route.
- Gemma4 12B and OLMo Think had no eligible integrated hosted mapping.
- Cloudflare Llama routes are documented static integrations; they have not been authenticated or quota-tested. Llama3.1 is explicitly FP8.

Public advertisement does not establish that your account can execute inference, has quota, or receives a fixed immutable checkpoint. Unknown precision, unreported cost/token usage, failed/aborted billing, and provider revisions are retained as limitations. The source audit is in [PROVIDERS.md](../PROVIDERS.md).

## Reproduce

```sh
npm ci
npm run typecheck
npm test
npm run build
npm start
# In another terminal, from this folder:
node scripts/smoke.mjs
```

The smoke script writes its report and adds demo validation experiments. It never requests hosted inference. To validate a real integration, configure one server-side key, select one exact supported model, choose Live providers, and run N=1 with a small output budget. Provider quota and charges apply.
