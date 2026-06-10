# ADR 0004 — `track.set_volume` scale

**Date:** 2026-06-09
**Status:** Accepted
**Author:** architect

## Context

LiveAPI exposes `track.mixer_device.volume.value` as a float 0.0..1.0 (normalized), where 0.85 ~ 0 dB, 1.0 ~ +6 dB. dB is not linear on the slider.

DAW wrappers (Reaper, Pro Tools API) typically expose dB. ahujasid/ableton-mcp uses 0..1.

## Decision

`track.set_volume` receives `volume: number` in 0.0..1.0. **Does not** accept dB directly.

Additional: the tool returns `volume_db_approx: number` computed via standard conversion (-inf, -60, ..., +6 dB) so the LLM has a reference.

## Why

- Mirrors LiveAPI 1:1 (no server-side conversion gives precision).
- Simplicity agreement for the JSON-RPC contract: 1 unit per param.
- LLM can request a future `vol_from_db(-6)` helper in a recipe — non-blocking.

## Approximate `volume → dB` conversion (Live curve)

| volume | dB    |
|--------|-------|
| 0.000  | -inf  |
| 0.200  | -42   |
| 0.400  | -22   |
| 0.600  | -10   |
| 0.700  | -4    |
| 0.850  |  0    |
| 1.000  | +6    |

Live's real curve is piecewise (3 segments). The Python implementation approximates with a table + linear interpolation; accepts error <0.5 dB. Phase 4 may swap for the exact curve if necessary.

## How to apply

- `bridge/handlers/track.py::set_volume` clamps 0..1, computes approx dB, calls `track.mixer_device.volume.value = v`.
- TS tool: Zod `z.number().min(0).max(1)`.
- Output: `{ ok, verified, changed, before: number, after: number, before_db: number, after_db: number }`.
