# QA Report — Cycle 9

**Date:** 2026-06-09
**Verdict:** **PASS-WITH-WARNINGS**

## Summary

Phase 5 (preview/verify) started. Recipes (Track C) debuted. Knowledge jumps to **20 devices**. TD-024 and TD-025 closed.

## Tech debt

| ID | Status |
|---|---|
| TD-004 | 🟡 PENDING (user) |
| TD-005 | 🟡 PENDING (sandbox) |
| TD-024 (Sampler complete) | ✅ CLOSED — 49 curated params + modulation_matrix |
| TD-025 (mock helper) | ✅ CLOSED — `install_listener_methods()` + `fire_listener()` in `_fakes/live_api.py` |

**2 closed in Cycle 9. Open: only TD-004/005.**

## Phase 5 — preview + verify

- `session.snapshot` — deep read of tempo, transport, tracks, clips, devices.
- `session.diff` — recursive diff between snapshots; ignores `ts`.
- `render.preview` — `snapshot` mode (Phase 5); `bounce` mode planned for Cycle 10.

3 MCP tools: `session_snapshot`, `session_diff`, `render_preview`. Full Zod-validated schema.

Foundation for **full verify loop** (LLM takes snapshot, mutates, takes snapshot again, sees diff).

## Recipes — Track C debuts (ADR-0007)

- `src/recipes/index.ts` Zod-typed loader.
- `src/recipes/runner.ts` executor with mustache placeholders + dotted-let bindings.
- 2 MCP tools: `list_recipes` (filter by category), `apply_recipe` (overrides + partial progress on failure).
- 1 seed recipe: `recipes/drums/tech-house-kick.json` (4-on-the-floor kick with Drum Cell + 4 inputs).

`apply_recipe` returns `{ applied, completed, failed_at?, error?, bindings }`. No rollback (Phase 6 adds it via undo batch).

## Knowledge — 20 devices / ~520 params

New Cycle 9:
| Device | Params |
|---|---|
| Sampler (TD-024 complete) | 49 |
| Limiter | 6 |
| Glue Compressor | 11 |
| Bass | 19 |
| Drift | 30 |
| Hybrid Reverb | 19 |

PLAN.md §5 target 50+ → **40% done**.

## Total MCP tools: 26

Was 23. +3 Phase 5 + 2 recipes (note: `apply_recipe` returns `ok: boolean` via recipe outcome — intentional design).

## Warnings

### W1 — Cycle 9 tests not written (TD-026)
Phase 5 handlers + recipe runner without coverage. Medium.

### W2 — Contract doc not updated (TD-027)
§27..§29 (session.*, render.preview) + §30 (recipes) missing. Low.

### W3 — `recipes/recipe-schema.json` referenced but not created
Recipes point to `$schema: "../recipe-schema.json"` which does not exist (loader ignores). TD-028 (trivial).

### W4 — `tech-house-kick` recipe assumes drum_cell already loaded
Recipe does not do `browser.load_item` for Drum Cell. In real runtime, a freshly created MIDI track has no device. Cycle 10 should add a step or create a "complete-from-scratch" variant. TD-029 (low).

## Recommendation

**PASS Cycle 9.** Next:

Cycle 10:
- Real smoke (TD-004).
- TD-026 (Phase 5 + recipes tests).
- TD-027 (contract doc).
- TD-028 (recipe-schema.json).
- TD-029 (recipe drum loading).
- Phase 5 cont: `render.preview` bounce mode (`freeze_track` + export).
- Phase 6 start: Push 1/2/3 LED/pad control (PLAN.md §4.18).
- +5 devices: Pedal, Roar, Vocoder, Beat Repeat, Erosion.
- +3 recipes: `bass/sub-808`, `racks/sidechain-rack`, `mixing/master-bus`.
