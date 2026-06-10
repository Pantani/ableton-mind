# QA Report — Cycle 17

**Date:** 2026-06-09
**Verdict:** **PASS-WITH-WARNINGS**

## Summary

TD-043 closed. **Knowledge reaches 55 devices** (110% of PLAN §5 target = 50). PT README updated. Version 0.0.17.

**Blocker for tag v0.1.0-rc.1: TD-004 (real smoke) — depends on user.**

## Tech debt

| ID | Status |
|---|---|
| TD-004 | 🟡 PENDING (user) — BLOCKS rc.1 |
| TD-005 | 🟡 PENDING (sandbox) |
| TD-030 | 🟡 PENDING (Push hardware) |
| TD-043 (remaining MIDI effects) | ✅ CLOSED |

**1 closed. Open: TD-004/005/030 (all real-environment).**

## TD-043 — 5 MIDI effects

- **Chord** (12 params: 6 shift slots × 2: shift semitones + velocity offset).
- **Note Length** (7 params: length, sync, gate, on/off balance, decay).
- **Random** (5 params: chance, choices, scale, sign, mode).
- **Scale** (6 params: base, transpose, lower/upper range, fold, OOR mode). 12-cell grid not exposed (TODO Phase 8).
- **Velocity** (9 params: drive, compand, random, mode, range mapping).

Total MIDI effects covered: 7 (Pitch, Arpeggiator + the 5 above). PLAN.md §4.16 ahujasid full coverage.

## Knowledge — 55 devices

Coverage map by category:
- **instrument** (8): Wavetable, Operator, Sampler, Simpler, Drum Cell, Bass, Drift, Meld.
- **audio_effect** (38): saturation/dist (6), dynamics (6), EQ (3), filter (1), modulation (5), delay (5), reverb (4), utility (8).
- **midi_effect** (7): Pitch, Arpeggiator, Chord, Note Length, Random, Scale, Velocity.
- **drum_rack** (1): Drum Rack (+drum_pads metadata).
- **TOTAL: 55 devices, ~800 indexed parameters.**

PLAN.md §5 target = 50+ → 110% ✅.

## Version: 0.0.17

`package.json` + `dxt/manifest.json` + CHANGELOG sync.

## Total MCP tools: 31 (unchanged)

## Warnings

### W1 — TD-004 still blocks rc.1
No action possible in sandbox.

### W2 — Scale device: 12-cell grid not exposed
The interactive grid of the Scale UI maps pitch class → target. It is not an automatable param. Phase 8 can expose via LOM `scale_map` (embedded TODO).

### W3 — External Audio Effect: routing strings
Input/Output routing are strings populated by the Live runtime — not exposable as static knowledge. Embedded TODO.

## Recommendation

**PASS Cycle 17.** Complete system, knowledge >100% target. Next:

Cycle 18 (or Release Window):
- **TD-004 real smoke** ← BLOCKER. When it passes, tag `v0.1.0-rc.1`.
- Minor cleanup: tech-debt.md, agents recap.
- Eventually final v0.1.0 after rc.1 validation.
