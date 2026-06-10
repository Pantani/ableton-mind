# QA Report — Cycle 15

**Date:** 2026-06-09
**Verdict:** **PASS-WITH-WARNINGS**

## Summary

TD-041 closed. Knowledge reaches **45/50 = 90%** PLAN.md §5. Recipes 12. Version 0.0.15.

**Blocker for tag v0.1.0-rc.1: TD-004 (real smoke) — depends on user.**

## Tech debt

| ID | Status |
|---|---|
| TD-004 | 🟡 PENDING (user) — BLOCKS rc.1 |
| TD-005 | 🟡 PENDING (sandbox) |
| TD-030 | 🟡 PENDING (Push hardware) |
| TD-041 (knowledge units convention) | ✅ CLOSED — `src/knowledge/README.md` |

**1 closed. Open: TD-004/005/030 (all real-environment).**

## TD-041 — Knowledge units convention

`src/knowledge/README.md` documents:
- Full schema structure.
- **Table of 16 canonical unit types** (linear, curve, Hz, dB, s, ms, semitones, cents, octaves, MIDI, °, Q, %, BPM, bits, enum, bool, voices/count, ratio).
- **`linear` vs `curve` rule**: linear mirrors the slider exactly; curve is 0..1 visual but the engine applies a non-linear curve → 0.5 ≠ "audible half".
- Process to add a device: extract → curator → KNOWN_DEVICES → tests.

Applied already in Cycle 15: Drum Buss Drive (Cycle 14) preceded but now `Dynamic Tube::Drive` and `Dynamic Tube::Bias` use explicit `unit: "curve"`. Earlier devices remain carry-over for re-annotation (TD-042 low).

## Knowledge — 45 devices (90% PLAN.md §5) 🎯

New Cycle 15: Cabinet (guitar IR sim), Dynamic Tube (3-type sat with curve units), Filter Delay (3 lines L/L+R/R), Grain Delay (granular pitch/spray), Utility (essential mixing).

## Recipes — 12

New Cycle 15:
- `drums/jungle-break` — Amen-style 170 BPM, kick + ghost snare + off-beat hat, 16 notes.
- `bass/reese` — Operator detuned saws (A+B level 0.7) + Filter LP24 + Chorus-Ensemble. D&B / neurofunk.

Drums and Bass now have 2 recipes each (was 1).

## Total MCP tools: 31 (unchanged)

## Version: 0.0.15

`package.json` + `dxt/manifest.json` + CHANGELOG sync.

## Warnings

### W1 — Earlier devices not re-annotated with `unit: "curve"` where applicable
TD-042 (low): Drum Buss, Pedal, Roar, Saturator have Drive/Amount using `unit: "linear"` but the engine is non-linear. Progressive re-curation in Cycle 16+.

### W2 — TD-004 continues to block rc.1
No action possible in sandbox.

## Recommendation

**PASS Cycle 15.** Next:

Cycle 16:
- **TD-004 real smoke** (BLOCKER).
- TD-042 curve units re-annotation.
- Tag `v0.1.0-rc.1` (after smoke PASS).
- +5 devices → target 50/50 (100%).
- +2 recipes.
- Commit + push.
