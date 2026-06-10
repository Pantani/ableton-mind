# AGENTS.md

This file provides guidance to Codex (Codex.ai/code) when working with code in this repository.

## Repository state

This repo has moved past the original planning-only state. Treat [PLAN.md](PLAN.md) as the scope source of truth, and `_workspace/PROGRESS.md` as the current implementation state.

Before scaffolding anything, confirm with the user that the open decisions in [PLAN.md §13](PLAN.md) are resolved (TS vs Python, min Live version, Mac-first vs cross-platform, name, license, etc.). Several were pending input as of the last session.

## What ableton-mind is

An MCP (Model Context Protocol) server that exposes the full Ableton Live Object Model (LOM) to LLMs, modeled on the `tdmcp` (TouchDesigner) project. The differentiators vs existing work ([ahujasid/ableton-mcp](https://github.com/ahujasid/ableton-mcp) at ~10% LOM, [ideoforms/AbletonOSC](https://github.com/ideoforms/AbletonOSC) which isn't MCP) are spelled out in [PLAN.md §1](PLAN.md):

1. **~100% LOM coverage** (~180 tools planned across 21 domains — see §4).
2. **Embedded knowledge base** — JSON schemas for 50+ native Live 12 devices, scales, grooves, packs, MIDI standards (§5). Goal: LLM never guesses parameter names/ranges.
3. **Recipes** — declarative JSON for drum kits, basslines, racks, arrangements by genre (§6). Server expands recipes into tool sequences.
4. **create → verify → preview loop** — after each batch, re-read state and diff against intent; optional render/screenshot for the LLM to "see" the result (§7).
5. **Reactive listeners** — LOM property changes pushed as MCP notifications (§4.21).

## Planned architecture (three layers)

See [PLAN.md §3](PLAN.md) for the full spec.

```
Codex/Cursor ──MCP──▶ ableton-mind server (TS/Node) ──TCP JSON-RPC──▶ Remote Script (Python, inside Live)
```

- **MCP server** (`src/`): TypeScript + Node 20+, `@modelcontextprotocol/sdk`, Zod validation. Holds tools, recipes, knowledge base. Routes calls to the bridge.
- **Bridge** (`live/AbletonMind/`): Python Remote Script loaded by Live (Python 3.11 on Live 12, 3.7 on Live 10/11). Hosts a local TCP server (default `:9876`) speaking JSON-RPC 2.0. Dispatches to LiveAPI; pushes listener events as JSON-RPC notifications.
- **Knowledge/recipes** (`src/knowledge/`, `recipes/`): static JSON shipped with the package.

OSC is planned as an **optional transport** (`ABLETON_MIND_TRANSPORT=osc`) for users already running AbletonOSC — not the primary path. The primary protocol is JSON-RPC over TCP because it is typed, batchable, and has structured errors (§3.2).

Remote Script install paths:
- macOS: `~/Music/Ableton/User Library/Remote Scripts/AbletonMind/`
- Windows: `~/Documents/Ableton/User Library/Remote Scripts/AbletonMind/`

Activation: Live → Preferences → Link/Tempo/MIDI → Control Surface.

## Design invariants (apply to every tool added)

From [PLAN.md §2](PLAN.md) — these are not aspirational, they are acceptance criteria:

- **Idempotent**: a tool called twice with the same args produces one effect. Check state before mutating.
- **Transactional**: composite operations wrap in `Song.begin_undo_step()` / `end_undo_step()` so undo is unitary.
- **Reversible**: destructive tools snapshot before acting.
- **Read-before-write**: never assume Track N exists or is the right type — verify first.
- **Schema-aware**: device parameters are addressed by name via the knowledge base, not by raw index. The LLM should not have to know that "Osc 1 Position" is parameter 0 on Wavetable.
- Tools return `{ ok, verified, diff }`, not just `ok`.

## Repo layout planned (mirrors `tdmcp/src/`)

Full tree in [PLAN.md §3.3](PLAN.md). Key directories when scaffolding begins:

- `src/tools/` — one file per LOM domain (transport, track, clip, scene, device, rack, automation, modulation, browser, arrangement, recording, mixer, view, session, groove, midi, push, introspection).
- `src/live-client/` — TCP/OSC client to the bridge.
- `src/knowledge/devices/` — one JSON per native device with full parameter schema.
- `src/recipes/{drums,bass,chords,racks,arrangements,mixing}/` — genre-tagged JSON recipes.
- `live/AbletonMind/` — Python Remote Script (bridge.py + handlers/ + listeners.py).
- `dxt/` — `.mcpb` manifest for Codex Desktop one-click install.

## Roadmap phases (PLAN.md §12)

Work proceeds in 8 phases. Phase 0 is the spike: scaffold the TS server, minimal Python bridge with ~5 handlers, one MCP tool (`play`) working end-to-end. Do not skip ahead: parity with `ahujasid` (Phase 1) and `AbletonOSC` (Phase 2) comes before knowledge base (Phase 3) and advanced coverage (Phase 4).

## Working in this repo today

- Documentation is in **English** at the repo root. Localized VitePress pages live only under `docs/pt/`.
- When the user asks to "start Phase 0" or scaffold, reference `tdmcp` structure but don't blindly copy — adapt to Ableton's domain.
- No commands to run yet (no `package.json`, no test suite, nothing to build). When scaffolding lands, update this file with the actual `npm` / `pnpm` / `pytest` commands.

## Harness: 8-agent parallel team

**Goal:** build, extend, and maintain ableton-mind following PLAN.md, with 6 tracks running in parallel under a lead (architect) and a continuous QA.

**Trigger:** any request to **execute/implement/continue/scaffold/redo/sync/evaluate a phase** of the project, including local LLM/copilot work → invoke the `ableton-mind-build` skill. Conceptual questions about PLAN.md can be answered directly, without dispatching the team.

**Team (all `model: opus`):**
- `architect` — lead, ADRs, integration, phase gate
- `ts-server-engineer` — TS/Node MCP server
- `python-bridge-engineer` — Python Remote Script
- `knowledge-curator` — device schemas + packs
- `recipe-designer` — JSON music recipes
- `distribution-docs-engineer` — DXT, npm, Docker, docs, CI
- `qa-integration` — cross-checks (parity, contract drift, recipe lint), gate
- `local-copilot-engineer` — local LLM, `chat`/`ask`, tool tiers, safety policy

**Workspace:** `_workspace/` holds `PROGRESS.md`, `decisions/`, `contracts/`, `cycle-briefing-*.md`, `qa/*-report.md`, and summaries per cycle+track. Nothing lands in `src/`/`live/`/`recipes/`/`docs/` without QA approval.

**Parallel execution:** Phase × Tracks matrix in `.claude/skills/ableton-mind-build/SKILL.md`. Phase 0 (Spike) is sequential; Phases 1-7 launch tracks in parallel (`run_in_background: true`).

## Harness change history

| Date | Change | Target | Reason |
|------|--------|--------|--------|
| 2026-06-08 | Initial build — 7 agents + 7 skills + orchestrator + workspace | `.claude/agents/`, `.claude/skills/`, `_workspace/PROGRESS.md` | `/harness assemble a team to execute this plan across multiple phases in parallel` |
| 2026-06-10 | Added local-copilot track + tdmcp-compatible backlog | `.claude/agents/local-copilot-engineer.md`, `.claude/skills/local-copilot/`, `_workspace/tdmcp-compatible-features.md` | Port tdmcp local LLM feature and compatible backlog to ableton-mind |
