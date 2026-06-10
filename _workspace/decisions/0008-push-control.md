# ADR 0008 — Push 1/2/3 control via Sysex

**Date:** 2026-06-09
**Status:** Accepted
**Author:** architect

## Context

PLAN.md §4.18 + §12 Phase 6 promises controlling Push 1/2/3 (LEDs, pads, buttons, modes). Ableton exposes Push via MIDI Sysex on the Remote Script. There is no dedicated LiveAPI — we manipulate it directly.

## Decision

### Initial surface (Cycle 10)

- `push.set_pad_color { pad: 0..63, color: 0..127 }` — 8x8 pad grid, Ableton-standard color index.
- `push.set_button_led { button: string, color: 0..127, mode: "solid" | "blink" | "pulse" }` — canonical button name (`"Play"`, `"Record"`, `"Tap Tempo"`, `"Metronome"`, etc).

### Sysex framing

Push 2/3 use Sysex `F0 00 21 1D 01 01 ...` (Ableton vendor ID + device ID + command + args + F7). The bridge encapsulates via `ctrl._send_midi(bytes)`. Push 1 uses simple CC.

### Version detection

Phase 6 (Cycle 10): only Push 2/3 (most common today). Push 1 is TD for Phase 8.

Detection via `application.control_surfaces` enumeration. Phase 7 adds auto-discovery.

### Threading

Sysex sends directly on the handler thread (does not need the main thread — `_send_midi` is thread-safe per Push API docs).

### Errors

- `-32000` Push not detected (`error.data.detected: false`).
- `-32004` pad/button out of range.
- `-32003` unknown button name.

### Out of scope Cycle 10

- Modes (Note/Session/Drum/Step).
- Pad pressure.
- 64px display output.

Phase 6 expansion.

## Consequences

- `handlers/push.py` NEW file.
- `schemas.py` gets `PushSetPadColorInput` + `PushSetButtonLedInput`.
- Knowledge-aware TS tools: `push_set_pad_color`, `push_set_button_led`.
- Knowledge eventually loads `src/knowledge/push.json` with button mapping.

## How to apply

- Cycle 10: 2 handlers + 2 tool stubs (correct Sysex bytes, but real bridge may fail without Push connected — the bridge tests via mock).
- Cycle 11: modes + pressure.
