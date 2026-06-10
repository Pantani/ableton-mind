# Cycle 7 — 2026-06-09

**PLAN.md Phase:** Phase 4 (automation envelopes) starts. Phase 2 (listeners) expands. Phase 3 (knowledge) continues.

**Goal:** TD-020 trivial, TD-016 batch migration (6+ tools), 5 new listeners (track + clip), 2-3 automation handlers/tools, 5 new device schemas, ADR-0006.

## Strategy

Inline. Patterns 100% mature.

## Assignments

### Track A — Bridge
1. TD-020: `FakeDeviceParameter.__init__` receives `name`, `is_quantized`, `value_items`, `automation_state`.
2. `ListenerManager` gets track + clip listeners — dynamically registers for all tracks/clips existing at `setup()` time. Events: `event.track_<i>_name_changed`, `track_<i>_volume_changed`, `track_<i>_mute_changed`, `track_<i>_solo_changed`, `clip_<t>_<s>_is_playing_changed`.
3. Phase 4 handlers: `clip.envelope_set_points` (list of `(time, value)` in an automation envelope inside the clip), `arrangement.add_automation_point` (envelope in the arrangement).

### Track A — TS Server
1. Migrate to verify loop: `track_create`, `track_upsert`, `clip_set_loop`, `scene_fire`, `device_set_parameter`, `create_midi_clip` (TD-016 → 10/21 tools migrated).
2. 2 new Phase 4 tools: `clip_set_envelope`, `arrangement_add_automation_point`.

### Track B — Knowledge
1. `auto_filter.json`, `echo.json`, `saturator.json`, `delay.json`, `drum_rack.json` (the last is a macro: rack params + slot enumeration).
2. Update `KNOWN_DEVICES`.

### Track — Architect
1. ADR-0006: automation envelope shape (points as `Array<{time, value, curve_type?}>`, time scale in beats, value without normalization — uses the param's native range).

## Contracts

`clip.envelope_set_points`:
- request: `{ track_index, clip_slot_index, parameter_path: string, points: Array<{time, value, curve_type?}> }` — `parameter_path` resolves via knowledge on the TS path (e.g. `"mixer.volume"`, `"device.0.Cutoff"`).
- response: `{ changed: true, replaced: number, points: number }`.

`arrangement.add_automation_point`:
- request: `{ track_index, parameter_path, time, value, curve_type? }`.
- response: `{ added: true, time, value }`.

## Gate criteria

- [ ] TD-020 closed.
- [ ] TD-016: 10/21 tools using verify.
- [ ] 5 new listeners active in the bridge.
- [ ] 2 Phase 4 tools + handlers.
- [ ] 5 new devices (10 total).
- [ ] ADR-0006 written.
- [ ] PROGRESS updated.

## Next

Cycle 8: real smoke (TD-004), TD-016 finish (rest of the tools), expand automation (curve_type variants), Phase 4 cont, +10 devices.
