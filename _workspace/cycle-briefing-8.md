# Cycle 8 — 2026-06-09

**PLAN.md Phase:** Phase 2 + 3 + 4 continuation. Debt cleanup before Phase 5.
**Goal:** close TD-016/019/021/022/023 (5 items), +5 devices, leave only TD-004/005 (real-environment dependent) open.

## Strategy

Inline.

## Assignments

### Track A — Bridge
1. TD-023: `clip.envelope_set_points` accepts curve_type per point: `linear` (1 step), `hold` (2 steps: previous value until `time`, then jumps).
2. Cycle 7 consolidated tests (TD-022) — `test_cycle7.py`.

### Track A — TS Server
1. TD-019: extract SDK internal access into a single `_mcp-internals.ts` module with 1 `getServerNotifier(server)` function. notifications.ts imports from there. Easier to mock / abstract on SDK 2.x.
2. TD-016 finish: migrate all read-only tools (`track_list`, `track_get_info`, `session_get_info`, `browser_get_categories`, `browser_load_item`, `device_get_parameters`) to `verified: true` (declarative — read-only is always verifiable); `clip_add_notes` (idempotency by count); `clip_fire`/`clip_stop` (UNVERIFIABLE), `play`/`stop` (UNVERIFIABLE — async transport state). Target total: **23/23**.
3. Cycle 7 TS tests: locator parser + sceneFireTool already exist, arrangement + clip_set_envelope (mocked) are missing.

### Track B — Knowledge
1. `drum_cell.json`, `sampler.json`, `simpler.json`, `tuner.json`, `phaser_flanger.json`.
2. Update `KNOWN_DEVICES`.

### Track — Architect
1. TD-021: §25 (clip.envelope_set_points) + §26 (arrangement.add_automation_point) in phase0-methods.md.

## Gate criteria

- [ ] TD-016/019/021/022/023 closed.
- [ ] 15 devices in the knowledge (was 10).
- [ ] PROGRESS updated reflecting: 23/23 verify, 15 devices, Phase 4 with curve_type.

## Next

Cycle 9: real smoke (TD-004), Phase 5 begins (preview / render), Phase 3 expansion to 25-30 devices.
