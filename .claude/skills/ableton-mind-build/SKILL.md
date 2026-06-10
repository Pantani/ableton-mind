---
name: ableton-mind-build
description: Orchestrates the 8-agent ableton-mind team for concrete build, scaffold, phase execution, local-copilot work, continuation, QA gate or roadmap-cycle work.
---

# ableton-mind-build — Team Orchestrator

Use this skill whenever the user asks to execute, implement, continue, scaffold, redo, synchronize, evaluate or gate concrete work for ableton-mind. Conceptual questions about PLAN.md can be answered directly without launching a full cycle.

## Team

| Track | Agent | Domain |
|---|---|---|
| Lead | architect | plan, ADRs, integration, phase gates |
| A — Server | ts-server-engineer | TS/Node MCP server, tools, resources, prompts |
| A — Bridge | python-bridge-engineer | Python Remote Script, LiveAPI, TCP JSON-RPC |
| B — Knowledge | knowledge-curator | device schemas, packs, scales, MIDI data |
| C — Recipes | recipe-designer | JSON music recipes |
| D — Distribution | distribution-docs-engineer | MCPB/DXT, npm, Docker, docs, CI, CLI |
| E — QA | qa-integration | parity, contract drift, recipe lint, smoke, gate |
| F — Local Copilot | local-copilot-engineer | local LLM, chat, ask, tool tiers, safety policy |

## Phase 0 — Always Gather Context First

1. Read PLAN.md.
2. Read _workspace/PROGRESS.md if it exists.
3. List _workspace/decisions/ and _workspace/qa/.
4. List _workspace/cycle-briefing-*.md.
5. Choose the mode:

| Mode | When | Action |
|---|---|---|
| Initial | PROGRESS.md does not exist | Create workspace state and plan Phase 0 spike |
| Continue | PROGRESS.md points to ongoing work | Write the next cycle briefing and continue |
| Redo phase | User requests a redo | Archive current workspace and recreate the requested scope |
| Phase gate | QA exists but PROGRESS is stale | Read verdict, update PROGRESS and decide next cycle |
| Sync only | User asks status | Report state without dispatching tracks |

## Cycle Briefing

The architect writes _workspace/cycle-briefing-{N}.md with: PLAN phase, one-sentence goal, assignments per track, changed contracts, dependencies and gate criteria. Keep tasks concrete and file-scoped.

## Execution

Run tracks in parallel only when their write scopes do not conflict and the current tooling/user permission allows sub-agents. Phase 0 spike is sequential: contract, bridge, server, integration. Later phases can run server, bridge, knowledge, recipes, distribution, local-copilot and QA in parallel as dependencies allow. Local-copilot work owns `src/llm/` and `src/cli/chat.ts`; coordinate with distribution for public docs and with QA for safety-tier tests.

## Integration

When work returns, read each _workspace/*_summary.md and the QA report. Compare delivered work with the briefing, write or update ADRs for contract changes, update PROGRESS.md and report the outcome in under 200 words.

## Invariants

- Nothing lands in production paths without QA evidence.
- Contract mutations require an ADR.
- QA is a gate input; the architect makes the final phase decision.
- Never run two workers against the same ownership boundary in the same cycle.
- Preserve unrelated local changes.
- Keep English as the default repo language; localized pages belong under docs/pt only.
