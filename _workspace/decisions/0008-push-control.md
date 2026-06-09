# ADR 0008 — Push 1/2/3 control via Sysex

**Data:** 2026-06-09
**Status:** Aceito
**Autor:** architect

## Contexto

PLAN.md §4.18 + §12 Phase 6 promete controlar Push 1/2/3 (LEDs, pads, botões, modos). Ableton expõe Push via Sysex MIDI no Remote Script. Não há LiveAPI dedicada — manipulamos diretamente.

## Decisão

### Surface inicial (Cycle 10)

- `push.set_pad_color { pad: 0..63, color: 0..127 }` — pad grid 8x8, color index ableton-padronizado.
- `push.set_button_led { button: string, color: 0..127, mode: "solid" | "blink" | "pulse" }` — button name canônico (`"Play"`, `"Record"`, `"Tap Tempo"`, `"Metronome"`, etc).

### Sysex framing

Push 2/3 usam Sysex `F0 00 21 1D 01 01 ...` (Ableton vendor ID + device ID + command + args + F7). Bridge encapsula via `ctrl._send_midi(bytes)`. Push 1 usa CC simples.

### Detecção de versão

Phase 6 (Cycle 10): apenas Push 2/3 (mais comuns hoje). Push 1 fica TD para Phase 8.

Detecção via `application.control_surfaces` enumeration. Phase 7 adiciona auto-discovery.

### Threading

Sysex envia direto na thread do handler (não precisa main thread — `_send_midi` é thread-safe segundo docs Push API).

### Errors

- `-32000` Push não detectado (`error.data.detected: false`).
- `-32004` pad/button fora de range.
- `-32003` button name desconhecido.

### Out of scope Cycle 10

- Modes (Note/Session/Drum/Step).
- Pad pressure.
- Display 64px output.

Phase 6 expansão.

## Consequências

- `handlers/push.py` NEW file.
- `schemas.py` ganha `PushSetPadColorInput` + `PushSetButtonLedInput`.
- TS tools knowledge-aware: `push_set_pad_color`, `push_set_button_led`.
- Knowledge eventualmente carrega `src/knowledge/push.json` com mapeamento de buttons.

## Como aplicar

- Cycle 10: 2 handlers + 2 tools stub (Sysex bytes corretos, mas bridge real pode falhar sem Push conectado — bridge testa via mock).
- Cycle 11: modes + pressure.
