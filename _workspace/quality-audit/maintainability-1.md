# Maintainability Audit 1

**Date:** 2026-06-10
**Mode:** read-only audit

## Checks

- `npm run typecheck`: PASS after `npm ci`.
- `npm run lint`: PASS.
- `npm run lint:py`: PASS.
- `npm run deps:validate`: PASS.
- `npm run complexity`: FAIL.
- `npm run complexity:py`: PASS.
- `npm test`: PASS-WITH-SKIPS.
- `npm run test:bridge`: PASS-WITH-SKIPS.

## Findings

### MAJOR: `npm run complexity` fails in local LLM/copilot

- Evidence: complexity failures in `src/cli/chat.ts:219`, `src/cli/chat.ts:298`, `src/llm/agent.ts:64`, `src/llm/client.ts:78`, `src/llm/server.ts:169`, `src/llm/tools.ts:342`.
- Risk: official maintainability gate is red; future local-copilot changes are harder to review safely.
- Suggested fix: split CLI parsing/execution, extract HTTP routing, separate agent tool loop, isolate SSE parsing and tool dispatch helpers.
- Verification: `npm run complexity`, `npm test -- tests/llm-local-copilot.test.ts`, `npm run typecheck`, `npm run lint`.

### MAJOR: LLM tool catalog duplicates MCP registry

- Evidence: MCP registry is `src/tools/index.ts`; local LLM catalog lives separately in `src/llm/tools.ts`.
- Risk: tool names, schemas and safety flags can drift.
- Suggested fix: keep an explicit LLM allowlist but derive name/description/schema from `ToolDefinition` where possible, with a parity test.
- Verification: `npm test -- tests/llm-local-copilot.test.ts`, `npm run deps:validate`.

### MAJOR: Runtime versions are hard-coded and stale

- Evidence: `src/index.ts` logs `version: "0.0.1"` and registers server version `0.0.19`; `src/live-client/handshake.ts` uses `TS_CLIENT_VERSION = "0.0.1"` while package/manifests are `0.1.0`.
- Risk: release support/debugging gets misleading version data.
- Suggested fix: centralize runtime version from package metadata or generated version module, and test it.
- Verification: `npm test -- tests/distribution-validation.test.ts`, startup smoke should log `0.1.0`.

### MINOR: `render_preview` exposes `bounce` but bridge rejects it

- Evidence: TS preview schema allows `mode: "bounce"`; Python handler still treats bounce as unavailable/stub.
- Risk: public option appears supported but fails at runtime.
- Suggested fix: remove `bounce` from schema until implemented, or implement and test it end-to-end.
- Verification: `npm test -- tests/phase5-6-recipes.test.ts`, `npm run test:bridge`.

### MINOR: Skipped tests hide listener/error paths

- Evidence: Vitest reports 4 skipped tests; Python bridge reports 2 skipped tests.
- Risk: regressions in JSON-RPC error mapping and listener expansion can pass.
- Suggested fix: repair deterministic fakes and re-enable targeted tests.
- Verification: `npm test`, `npm run test:bridge`.

### MINOR: Python validation is distributed per handler

- Evidence: dataclasses and handlers share loose validation patterns.
- Risk: TS/Python contract drift and inconsistent error shapes.
- Suggested fix: add common validation helpers in small slices with negative tests.
- Verification: `npm run test:bridge`, `npm run complexity:py`, `npm run lint:py`.

### NICE: Add automated TS/Python/recipe parity gate

- Evidence: `deps:validate` only covers TS/JS import boundaries; bridge methods and recipe ops are dynamic.
- Suggested fix: add read-only QA script extracting `@register(...)`, `ctx.bridge.call(...)` and recipe operations with allowlist.
- Verification: new parity command plus `npm test`.
