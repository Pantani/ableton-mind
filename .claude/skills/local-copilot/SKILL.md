---
name: local-copilot
description: Use this for any ableton-mind local LLM/copilot work: Ollama, OpenAI-compatible endpoints, `ableton-mind chat`, `ableton-mind ask`, `llm-run`, tool tiers, safe/default read-only policy, local browser UI, headless prompts, model pull, handoff, or docs/tests for the local copilot. Also use for follow-ups like re-run, update, debug, harden, add a model backend, or port more tdmcp copilot behavior.
---

# local-copilot

Use this skill when adding, debugging or extending the ableton-mind local LLM feature.

## Context Check

1. Read `src/llm/config.ts`, `src/llm/tools.ts`, `src/llm/agent.ts`, `src/llm/server.ts` and `src/cli/chat.ts`.
2. Read `tests/llm-local-copilot.test.ts` and the latest relevant QA report.
3. Check `_workspace/tdmcp-compatible-features.md` for deferred tdmcp-inspired items.
4. Confirm whether the request is UI chat, headless `ask`, model/backend, safety tier, docs, or QA.

## Safety Rules

- Keep the default tier read-only (`safe`). Use explicit `--write` for simple mutations and `--creative` for recipes/browser load.
- Never expose destructive or broad routing/mixer tools to a local model without a safety review.
- Preserve the bridge-offline behavior: the chat UI can open without Live; live tools must return clear bridge errors.
- Browser server stays loopback-only and must reject non-loopback Host/Origin.
- Do not copy TouchDesigner-specific prompts, paths or tools from `tdmcp`.

## Implementation Rules

- Prefer explicit JSON Schemas in `src/llm/tools.ts` over new schema-conversion dependencies.
- The local copilot should use existing `ToolDefinition` handlers, not duplicate Ableton business logic.
- Add or update tests whenever changing config defaults, tool tier membership, agent loop behavior, CLI parsing or server endpoints.
- Public docs belong in English root docs and matching Portuguese pages under `docs/pt/`.

## Verification

Run focused checks first:

```bash
npm run typecheck
npx vitest run tests/llm-local-copilot.test.ts
```

For broader changes, add:

```bash
npm run lint
npm run test
npm run build
```

Live/Ollama validation is optional unless the task changes runtime connectivity. If skipped, report it explicitly.

## Test Scenarios

- Normal: `ableton-mind ask --read-only "What is in this set?"` with Ollama reachable and bridge connected.
- Offline bridge: `ableton-mind chat --no-ollama --no-open` opens the local UI even when Live is closed; live tool calls return a bridge-offline error.
- Safety: default config resolves to `safe`; `--write` switches to `standard`; `--creative` exposes recipes/browser load.
