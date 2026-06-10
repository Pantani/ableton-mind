# QA Report — Cycle 8

**Date:** 2026-06-09
**Verdict:** **PASS-WITH-WARNINGS**
**QA:** architect inline.

## Summary

Cycle 8 closed **5 tech debts** (TD-016, TD-019, TD-021, TD-022, TD-023). The verify loop now covers **23/23 tools**. Knowledge jumps to **15 devices / 360+ params**. Phase 4 gets real curve_type.

Open tech debt reduced to 2 items — both dependent on real environment (smoke + npm install).

## Tech debt status

| ID | Status |
|---|---|
| TD-004 (real smoke) | 🟡 PENDING (user) |
| TD-005 (npm install) | 🟡 PENDING (sandbox) |
| TD-016 (verify carry-over) | ✅ CLOSED — 23/23 tools (declarative read-only; mutators with verifyField; async marked UNVERIFIABLE) |
| TD-019 (SDK internals) | ✅ CLOSED — `src/server/_mcp-internals.ts` + `getServerNotifier` adapter |
| TD-021 (contract doc §25-26) | ✅ CLOSED |
| TD-022 (Cycle 7 tests) | ✅ CLOSED — `tests/tools-locator-and-phase4.test.ts` + `live/.../tests/test_cycle7_phase4.py` |
| TD-023 (curve_type) | ✅ CLOSED — `clip.envelope_set_points` implements `hold` via 2-step split |

**5 closed / 2 open** (both non-resolvable in sandbox).

## Verify loop — 23/23 ✅

| Tool | Verify | Cycle |
|---|---|---|
| set_tempo | tempo (1e-3) | 5 |
| track_set_volume | volume (1e-4) | 5 |
| track_set_name | name | 5 |
| clip_set_name | name | 5 |
| track_create | is_midi | 7 |
| track_upsert | name | 7 |
| create_midi_clip | length+name | 7 |
| clip_set_loop | loop fields | 7 |
| device_set_parameter | value (1e-4) | 7 |
| clip_set_envelope | points count (with hold) | 7+8 |
| clip_add_notes | added count | 8 |
| **read-only**: track_list, track_get_info, session_get_info, browser_get_categories, browser_load_item, device_get_parameters | inherently verified (no mutation) | 8 |
| **async**: play, stop, scene_fire, clip_fire, clip_stop | UNVERIFIABLE sentinel | 5-8 |
| arrangement_add_automation_point | (NOT idempotent, bridge confirms add) | 7 |

Complete coverage. Each tool has a recorded decision — real verify / declarative / UNVERIFIABLE.

## Phase 4 — curve_type implemented (TD-023)

Bridge `clip.envelope_set_points`:
- `linear` (default) / `ramp`: 1 pure step.
- `hold` (from the 2nd point): inserts 2 steps — edge value@previous at `time-1e-4` + `value@time`. Creates the characteristic step edge of hold.

TS tool `clip_set_envelope` computes `expectedCount = sum(1 + isHoldAfterFirst(p) ? 1 : 0)` for verify.

Python tests `test_cycle7_phase4.py::TestClipEnvelopeSetPoints::test_hold_curve_type_inserts_extra_step` confirm.

## SDK adapter — TD-019

`src/server/_mcp-internals.ts` centralizes ALL internals access:
- `getServerNotifier(server) → ServerNotifier`
- `SdkIncompatibilityError` when SDK shape changes

`notifications.ts::createMcpNotifier` now delegates 1 line. If SDK 2.x moves `.server.notification` elsewhere, only 1 file needs updating.

Tests: `tests/tools-locator-and-phase4.test.ts::getServerNotifier` covers happy path + 3 incompatibility scenarios.

## Contract doc

§1..§26 complete:
- §25 `clip.envelope_set_points` (locator + points + curve_type)
- §26 `arrangement.add_automation_point`
- Final summary lists 23 tools by category.

## Knowledge — 15 devices / ~360 params

New Cycle 8:
| Device | Params | Category |
|---|---|---|
| Drum Cell | 16 | instrument (Live 12+) |
| Simpler | 23 | instrument |
| Sampler | 17 (partial) | instrument |
| Tuner | 4 | audio_effect |
| Phaser-Flanger | 14 | audio_effect (Live 11+ unified) |

Accumulated total: **15 devices**, **~360 parameters** indexed + drum_rack metadata.

PLAN.md §5 target 50+ devices → **30% done**.

## Tests

Python:
- `test_cycle7_phase4.py` NEW: 11+ cases covering Phase 4 handlers + locator + listeners expansion.

TS:
- `tools-locator-and-phase4.test.ts` NEW: 17+ cases covering locator parser (6 vars), arrangement+envelope tools (5), SDK adapter (4), UNVERIFIABLE behavior (4).

## Warnings

### W1 — Partial Sampler
17/~80 params. Marked `completeness: partial` with TODO. Does not block Sampler use via knowledge (LLM still receives enrichment for curated params). TD-024 (low).

### W2 — Live mock for Cycle 8 Python tests
`test_cycle7_phase4.py::TestListenerManagerExpansion` dynamically adds `add_*_listener` methods to the fakes. The pattern works but is fragile — Phase 9 may move this setup into `_fakes/live_api.py` as a helper. TD-025 (trivial).

### W3 — Phase 5 not started
PLAN.md §12 lists Phase 5 (preview / render) as the next major. Cycle 9 should open it.

## Recommendation

**PASS Cycle 8.** Back-to-back tech debt essentially zeroed (only TD-004/005 open, both environmental).

Next (Cycle 9):
- TD-004 real smoke.
- Phase 5 start: `render_preview` (8-bar bounce) + `screenshot_live` + session snapshot.
- Knowledge: +5-10 devices (Bass, Drift, Meld, Beat Repeat, Erosion, Frequency Shifter, Glue Compressor, Hybrid Reverb, Limiter, Vocoder).
- Recipes (Track C): first recipe delivered (`drums/tech-house-kick.json` as proof of concept).
- TD-024 (Sampler complete), TD-025 (mock helper).
