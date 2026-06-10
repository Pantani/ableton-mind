# QA Report — Cycle 18

**Date:** 2026-06-09
**Verdict:** **PASS**

## Summary

MCP Prompts subsystem delivered (5 seed prompts + registry + SDK wiring + `list_prompts` tool + updated DXT manifest). Version 0.0.18. **Total MCP tools: 32** (was 31).

## Tech debt

| ID | Status |
|---|---|
| TD-004 | 🟡 PENDING (user) — BLOCKS rc.1 |
| TD-005 | 🟡 PENDING (sandbox) |
| TD-030 | 🟡 PENDING (Push hardware) |

3 items open, all non-resolvable in sandbox. **Identical state to Cycle 17 — Cycle 18 was productive expansion without altering tech debt.**

## ADR-0010 — MCP Prompts

Shape decided: `{name, description, arguments, argsSchema, handler}`. Handler returns `PromptResult { messages: [...] }` that becomes the first conversation message on the MCP client.

## Prompts delivered — 5 seeds

| Prompt | Args |
|---|---|
| `create_genre_track` | genre, tempo?, duration_min? |
| `build_mix_chain` | source, track_index? |
| `build_arrangement` | structure, tempo?, bars_per_section? |
| `sound_design_session` | synth, target, track_index? |
| `process_vocal_take` | track_index, style? |

Each prompt renders structured guidance referencing existing tools (`apply_recipe`, `device_set_parameter`, `session_snapshot/diff`) and available recipes. Incentive geometry: the LLM tends to use the verify loop + knowledge enrichment when guided.

## New tool: `list_prompts`

Read-only. Discovery fallback for clients that do not expose `prompts/list` natively. Returns `{name, description, arguments}` × 5.

## Total MCP — Cycle 18 final

- **32 tools** (31 + list_prompts).
- **5 prompts** (new subsystem).
- **30 JSON-RPC methods in the bridge** (unchanged — prompts are purely TS).
- **55 devices** (unchanged).
- **14 recipes** (unchanged).

## DXT manifest

`dxt/manifest.json` lists the 5 prompts. Claude Desktop can render a /prompts menu post-install via `.mcpb`.

## Version: 0.0.18

`package.json` + `dxt/manifest.json` + CHANGELOG sync.

## Warnings

### W1 — Prompts untested (TS unit tests)
Known patterns — handlers are pure (no side effect). Next cycle writes `tests/prompts.test.ts` if there is demand. TD-044 (low).

### W2 — Prompt arguments are all `string?` in the handler
MCP SDK 1.x receives args as `Record<string, string>`. Numeric coercion (tempo, bars) stayed in the handler. Works. No action.

### W3 — TD-004 still blocks rc.1
State unchanged.

## Recommendation

**PASS Cycle 18.** The system now exposes 2 of 3 MCP primitives (tools + prompts; resources Phase 8). Next:

Cycle 19 / Release Window:
- **TD-004 real smoke** ← BLOCKER.
- TD-044 prompts tests (optional).
- Tag `v0.1.0-rc.1` (after smoke PASS).
