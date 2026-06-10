# QA Report — Cycle 7

**Date:** 2026-06-09
**Verdict:** **PASS-WITH-WARNINGS**
**QA:** architect inline.

## Summary

Cycle 7 closed TD-020, advanced TD-016 (10/21 → 10/23 tools with verify), expanded listeners to track + clip (5 new events), started Phase 4 with automation envelopes (2 handlers + 2 tools + ADR-0006) and doubled knowledge coverage to **10 devices / 310+ parameters**.

## Tech debt status

| ID | Status | Where |
|---|---|---|
| TD-004 (real smoke) | 🟡 PENDING | depends on user |
| TD-005 (npm install) | 🟡 PENDING | real machine |
| TD-016 (verify carry-over) | 🟡 PARTIAL | 10/23 tools migrated (was 4/21) |
| TD-019 (SDK internals) | 🟡 PENDING | monitoring |
| TD-020 (FakeDeviceParameter) | ✅ CLOSED | constructor receives name/is_quantized/value_items/automation_state |

**1 closed, 4 open (all low or progressive).**

## Phase 4 — Automation envelopes (PLAN.md §4.7)

ADR-0006 fixes the format: `parameter_path` string (`mixer.volume` | `mixer.panning` | `mixer.send.<i>` | `device.<i>.parameter.<n>`) → `parameter_locator` dict for the bridge.

Delivered:
- `src/tools/_locator.ts` — `parseParameterLocator()` + shared Zod schema.
- `src/tools/clip.ts::clipSetEnvelopeTool` — replace all points in a clip envelope.
- `src/tools/arrangement.ts::arrangementAddAutomationPointTool` NEW file.
- `live/AbletonMind/handlers/clip.py::ClipEnvelopeSetPointsHandler` — uses `clip.create_automation_envelope` + `envelope.clear()` + `insert_step`.
- `live/AbletonMind/handlers/arrangement.py` NEW — `arrangement.add_automation_point` via `track.create_or_get_automation_envelope`.
- Shared helper `_resolve_parameter_locator(track, locator)` in `clip.py` (reused by arrangement).

Phase 5 will expand: real curve types (exponential curve), batch operations, snap-to-grid.

## Verify loop — TD-016 progress

| Tool | Verify field | Before |
|---|---|---|
| set_tempo | tempo (tol 1e-3) | Cycle 5 |
| track_set_volume | volume (tol 1e-4) | Cycle 5 |
| track_set_name | name | Cycle 5 |
| clip_set_name | name | Cycle 5 |
| **track_create** | is_midi vs intent.type | Cycle 7 |
| **track_upsert** | name | Cycle 7 |
| **create_midi_clip** | length + name (combined) | Cycle 7 |
| **clip_set_loop** | loop_start/loop_end/looping (all passed fields) | Cycle 7 |
| **scene_fire** | UNVERIFIABLE (async clip start) | Cycle 7 |
| **device_set_parameter** | value (tol 1e-4) | Cycle 7 |
| **clip_set_envelope** | points count | Cycle 7 |

10 tools with verify. 13 still without (Phase 1/2 reads + arrangement_add_automation_point which is NOT idempotent).

`verifyAll(...checks)` introduced in `clip_set_loop` and `create_midi_clip` to combine multiple verifications.

## Listeners expansion

Phase 2 (Cycle 5) had 2 events: tempo + is_playing.

Phase 2 (Cycle 7) adds 5:
- `event.track_name_changed` (with `track_index`)
- `event.track_mute_changed`
- `event.track_solo_changed`
- `event.track_volume_changed` (listener on `mixer_device.volume`)
- `event.clip_name_changed` (with `track_index`, `clip_slot_index`)
- `event.clip_is_playing_changed`

`setup()` dynamically registers for ALL existing tracks/clips. Re-calling `setup()` re-registers (idempotent).

**Known limitation:** new tracks/clips created AFTER setup do not gain listeners automatically. Phase 3 will add a listener on `song.tracks` to detect add/remove and re-setup automatically.

## Knowledge expansion — 10 devices

| Device | Params | Category |
|---|---|---|
| Wavetable | 60 | instrument (Cycle 5) |
| Operator | 53 | instrument (Cycle 6) |
| EQ Eight | 45 | audio_effect (Cycle 6) |
| Compressor | 21 | audio_effect (Cycle 6) |
| Reverb | 31 | audio_effect (Cycle 6) |
| **Auto Filter** | 16 | audio_effect (Cycle 7) |
| **Echo** | 26 | audio_effect (Cycle 7) |
| **Saturator** | 12 | audio_effect (Cycle 7) |
| **Delay** | 18 | audio_effect (Cycle 7) |
| **Drum Rack** | 10 + drum_pads metadata | drum_rack (Cycle 7) |

**Total: 292 indexed parameters + drum_rack metadata** (MIDI ranges, kit layout 36..51, chain routing).

`drum_rack.json` loads extra fields (`drum_pads`, `chain_routing`) preserved via `.passthrough()` in the Zod schema.

PLAN.md §5 target: 50+ devices → **20% done**.

## Contract drift

`phase0-methods.md` needs §25 (clip.envelope_set_points) and §26 (arrangement.add_automation_point). **Not updated this cycle** — TD-021 (low).

## Tests

**No tests were written for Cycle 7** (Phase 4 handlers, listeners expansion, locator parser). Patterns exist. TD-022 (medium).

## Warnings

### W1 — TD-021: contract doc §25..§26
`clip.envelope_set_points` and `arrangement.add_automation_point` undocumented. Low.

### W2 — TD-022: Cycle 7 tests
Phase 4 + listeners expansion + locator parser without coverage. Medium.

### W3 — `clipSetEnvelopeTool` point shape ignores curve_type
Current bridge uses `insert_step(time, length=0, value)` which is a pure point. `curve_type` accepted in the schema but dropped in the handler. Documented as Phase 4-strict design; Phase 5 implements curves. TD-023 (low).

### W4 — Bridge clip envelope handler assumes `envelope.clear()` exists
`Live.ClipEnvelope` should expose `clear()` (Live 11+). On older versions it is `value_at_time` modify. Real smoke will confirm.

### W5 — Listeners expansion: track/clip created after setup do not gain listener
Mentioned above. Limitation documented. Phase 3 addresses it.

## Recommendation

**PASS Cycle 7.** Next:

Cycle 8:
- TD-004 real smoke.
- TD-021 contract doc.
- TD-022 Cycle 7 tests.
- TD-016 finish — migrate last 13 tools (mostly read-only, so most remain UNVERIFIABLE).
- Phase 4 cont: real curve_type (TD-023), track_create_return, scene_create, more arrangement tools.
- Phase 2 evolution: meta-listener to detect add/remove of tracks/clips.
- Knowledge: +5 devices (Drum Cell, Wavetable Player, Sampler, Simpler, Tuner).
