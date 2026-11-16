# OpenAI API migration decision ledger

Application: 모아, server/advisor.mjs. Assessment followed by implementation, explicitly requested 2026-11-17 KST.
Approved scope: replace customer-provided credentials/model with operator server secret; use GPT-6.1 Terra and extra high reasoning; preserve existing repayment comparison and financial-data isolation. User explicitly chose existing key reuse and identified Codex/OpenAI app connection. No new key creation authorized.

Stage 1 (authorized, implemented and locally verified): server-only key boundary, fixed model/effort, customer question UI, readiness, account/global rate limits, test and deploy.
Stage 2 (blocked by credential availability): configure OPENAI_API_KEY as a Sites secret and verify a live response. Sites environment revision 0 has no entries; task environment and conventional ignored env files contain no key; connected Platform tool can create but cannot retrieve an existing secret. Need secure provisioning decision. No credentials or financial values belong in this ledger.

| Guidance | Applicable / support | Decision and evidence |
|---|---|---|
| Model selection | Yes / yes | User requests gpt-6.1-terra; official model page confirms xhigh. No automatic fallback. Account model access awaits key. |
| Instruction file naming | No | No instruction files changed. |
| Responses migration | Already present | Keep direct fetch to https://api.openai.com/v1/responses; no SDK or provider migration. |
| Streaming | No for this change | Existing JSON-schema advice must complete and validate before the comparison strategy changes; retain waiting indicator and complete response. |
| WebSockets | No | One bounded HTTP request; no tools or multi-turn transport. |
| Privacy: Zero Data Retention | Unknown account entitlement | Preserve store:false and minimized anonymous loan labels. Do not claim ZDR; no new response retention, logging, or financial-history upload. |
| Privacy: residency | Unknown project settings | Keep existing official endpoint; no regional change requested. |
| Processing tiers | Standard applicable | Existing interactive workload, no priority/flex/batch/reserved purchase or tier change. |
| Cache keys | Not applicable | No new key for GPT-6.1, no stable long prefix. |
| Extended cache retention | Not applicable | No pre-5.6 model or retained prompt requested. |
| Explicit cache breakpoints | Not beneficial | Short instructions with request-specific financial summary; no repeated long documents or tools. Preserve implicit behavior. |
| Cache diagnostics | Not applicable | No prior response IDs retained or repeated agent loop. |
| State management | Already present | Single request, no stored conversation or previous_response_id. |
| Instruction persistence | Already present | Instructions sent on every request. |
| Encrypted reasoning replay | Not applicable | No replay/tool loop. |
| Reasoning effort | Yes / yes | xhigh, chosen explicitly by user; server controlled. |
| Reasoning preservation | Not applicable | No earlier turns. |
| Reasoning summaries/preambles | Not applicable | Existing product displays structured advice only. |
| Verbosity | Preserve | No existing explicit setting; schema and UI constrain length. No unrelated chattiness changes. |
| Maximum output tokens | Yes | Existing 2,400 total budget unsuitable for extra-high reasoning. Increase bounded budget to 16,384; timeout 180 s; incomplete is never success. |
| Assistant message phases | Not applicable | No message replay. Parse only final_answer or unphased output_text. |
| Context compaction | Not applicable | Bounded 2,000-character question plus server summary, no growing history. |
| Structured outputs | Already present / supported | Keep strict repayment_advice schema and validation. |
| Tool choice/search/additional tools | Not applicable | No tools exposed to model. |
| Parallel/programmatic tools | Not applicable | No tool calls or side effects. |
| Model-aligned interfaces | Not applicable | No tool interface changes. |

References checked 2026-11-17 KST:
- https://developers.openai.com/api/docs/models/gpt-6.1-terra
- https://developers.openai.com/api/docs/guides/reasoning
- https://developers.openai.com/api/reference/resources/responses/methods/create

Validation: full npm test suite passed, 103 tests; focused advisor suite passed, 17 tests. Tests cover server-only secret use, fixed Terra/xhigh request, client override rejection, account isolation, persisted daily quotas/KST rollover, concurrent-request leases, provider failures, absent secret, safe readiness and customer UI without key/model fields. npm run build, node --check dist/server/index.js and git diff --check passed. These use mocked OpenAI responses and real SQLite SQL. No live OpenAI request was made because the server secret is absent. Browser visual QA remains unavailable due the existing managed-preview routing failure; no bypass was attempted. Public launch remains outside this change; owner-private audience retained.
