# Cycle 9 — 2026-06-09

**PLAN.md Phase:** Phase 5 begins (preview/snapshot/diff). Recipes (Track C) debuts.

**Goal:** TD-024/025, +5 devices, snapshot/diff handlers, recipe loader + 1st recipe + `apply_recipe` tool, ADR-0007.

## Strategy

Inline. Auto mode.

## Assignments

### Track A — Bridge
1. TD-025: `live_api_with_listeners()` helper in `_fakes/` registers add_/remove_<prop>_listener for multiple props.
2. Phase 5 handlers:
   - `session.snapshot` — read deep state (tracks, clips meta, devices, tempo, transport).
   - `session.diff` — receives previous snapshot + reads current + returns diff.
   - `render.preview` — STUB (LiveAPI has no synchronous render-to-file; use `freeze_track` or flatten; Cycle 10 will integrate with export).

### Track A — TS Server
1. 3 tools: `session_snapshot`, `session_diff`, `render_preview`.
2. Recipe track: `src/recipes/index.ts` loader, `src/tools/recipe.ts` with `apply_recipe`, `list_recipes`.

### Track B — Knowledge
1. TD-024: complete Sampler (~80 params via curation).
2. +4 devices: Limiter, Glue Compressor, Bass, Drift (Hybrid Reverb deferred to Cycle 10 — it is complex).

### Track C — Recipes (debut)
1. `recipes/drums/tech-house-kick.json` — seed recipe: creates a MIDI track "Kick", adds Drum Cell, sets params (low Tune, short Decay, Saturation), inserts 4-to-floor notes.
2. ADR-0007 — canonical recipe format.

## Contracts

`session.snapshot` → `{ tempo, is_playing, time_signature, tracks: [...], total }`. Does not include audio.

`session.diff` → `{ from_ts, to_ts, changes: [...] }`. Each change: `{ path, before, after, kind }`.

`render.preview` Phase 5 stub: `{ mode: "snapshot" }` → returns enriched `session.snapshot`. Phase 5 real: `{ mode: "bounce", bars }` → `freeze_track` + path of the .wav.

`apply_recipe` (ADR-0007 simplified):
- request: `{ recipe_id: string, params?: dict }` (or `recipe: object`).
- response: `{ applied: true, steps: number, recipe_id }`.

## Gate criteria

- [ ] TD-024/025 closed.
- [ ] Phase 5: 3 handlers + 3 tools.
- [ ] Recipe loader + apply_recipe + 1 recipe.
- [ ] 5 devices (19 total).
- [ ] ADR-0007.

## Next

Cycle 10: real smoke, real render_preview (freeze→export), screenshot_live, +5 devices, +5 recipes.
