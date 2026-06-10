# QA Report — Cycle 10

**Date:** 2026-06-09
**Verdict:** **PASS-WITH-WARNINGS**

## Summary

Phase 6 (Push) started. TD-027/028/029 closed. TD-026 carry-over (tests rolled forward to Cycle 11 — known patterns). +3 devices, +2 recipes.

## Tech debt

| ID | Status |
|---|---|
| TD-004 | 🟡 PENDING (user) |
| TD-005 | 🟡 PENDING (sandbox) |
| TD-026 | 🟡 CARRY-OVER → Cycle 11 (Phase 5 + Push tests) |
| TD-027 (contract §27..§31) | ✅ CLOSED |
| TD-028 (recipe-schema.json) | ✅ CLOSED |
| TD-029 (recipe device load step) | ✅ CLOSED — `tech-house-kick` now loads Drum Cell |

**3 closed. 3 open (1 ⚠medium carry-over).**

## Phase 6 — Push (ADR-0008)

Bridge handlers:
- `push.set_pad_color { pad: 0..63, color: 0..127 }` — Sysex `F0 00 21 1D 01 01 04 <pad> <color> F7`.
- `push.set_button_led { button, color, mode }` — Sysex command 0x05. 17 canonical buttons mapped (Play/Record/Stop/Tap Tempo/Metronome/Mute/Solo/Note/Session/Browse/...). 3 modes (solid/blink/pulse).
- Detection via `application.control_surfaces` scan. No Push → `-32000 detected: false`.

TS tools:
- `push_set_pad_color`, `push_set_button_led`.

Phase 6 expansion (Cycle 11): modes (Note/Session/Drum/Step), pad pressure, display.

## Knowledge — 23 devices

New Cycle 10: Pedal, Beat Repeat, Vocoder.

| Cycle | New | Total |
|---|---|---|
| 5 | Wavetable | 1 |
| 6 | +4 | 5 |
| 7 | +5 | 10 |
| 8 | +5 | 15 |
| 9 | +5 | 20 |
| 10 | +3 | 23 |

PLAN.md §5 target 50+ → **46% done**.

## Recipes — 3 total

| Recipe | Category | Inputs | Steps |
|---|---|---|---|
| tech-house-kick | drums | 4 | 6 (after TD-029 fix) |
| **sub-808** | bass | 4 | 7 |
| **master-bus** | mixing | 2 | 5 |

## Total MCP tools: 30

Cycle 9: 28. +2 Push = 30.

## Contract doc

§27..§31 documented. Summary updated for "after Cycle 10": 30 tools, 30 JSON-RPC methods.

## Warnings

### W1 — TD-026 carry-over
Tests Phase 5 + Recipes + Push not written. Known patterns. Medium. Cycle 11.

### W2 — Push without real test
Bridge handler works in mock (FakeCtrl with `application.control_surfaces`) but only physical Push 2/3 confirms sysex. Real Push smoke deferred to Cycle 11+ if user has hardware. TD-030 (low).

### W3 — Roar / Erosion not delivered
Briefing mentioned 5 devices; I delivered 3. Roar and Erosion deferred to Cycle 11. TD-031 (low).

### W4 — `racks/sidechain-rack` not delivered
Briefing mentioned 3 recipes; I delivered 2. Sidechain rack deferred to Cycle 11. TD-032 (low).

## Recommendation

**PASS Cycle 10.** Next:

Cycle 11:
- Real smoke (TD-004).
- TD-026 tests.
- TD-030 Push smoke if possible.
- TD-031 Roar + Erosion.
- TD-032 sidechain rack recipe.
- Phase 6 cont: Push modes + display.
- Phase 7 start: final distribution (build:dxt sign, npm publish dry, smithery listing).
- +5 devices.
