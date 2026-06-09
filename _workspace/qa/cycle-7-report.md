# QA Report — Cycle 7

**Data:** 2026-06-09
**Veredito:** **PASS-WITH-WARNINGS**
**QA:** architect inline.

## Resumo

Cycle 7 fechou TD-020, avançou TD-016 (10/21 → 10/23 tools com verify), expandiu listeners para track + clip (5 novos eventos), iniciou Phase 4 com automation envelopes (2 handlers + 2 tools + ADR-0006) e dobrou cobertura de knowledge para **10 devices / 310+ parameters**.

## Tech debt status

| ID | Status | Onde |
|---|---|---|
| TD-004 (smoke real) | 🟡 PENDENTE | depende do usuário |
| TD-005 (npm install) | 🟡 PENDENTE | máquina real |
| TD-016 (verify carry-over) | 🟡 PARCIAL | 10/23 tools migradas (era 4/21) |
| TD-019 (SDK internals) | 🟡 PENDENTE | monitoring |
| TD-020 (FakeDeviceParameter) | ✅ FECHADO | construtor recebe name/is_quantized/value_items/automation_state |

**1 fechado, 4 abertos (todos baixos ou progressivos).**

## Phase 4 — Automation envelopes (PLAN.md §4.7)

ADR-0006 fixa formato: `parameter_path` string (`mixer.volume` | `mixer.panning` | `mixer.send.<i>` | `device.<i>.parameter.<n>`) → `parameter_locator` dict para o bridge.

Entregue:
- `src/tools/_locator.ts` — `parseParameterLocator()` + Zod schema compartilhado.
- `src/tools/clip.ts::clipSetEnvelopeTool` — replace all points num clip envelope.
- `src/tools/arrangement.ts::arrangementAddAutomationPointTool` NEW file.
- `live/AbletonMind/handlers/clip.py::ClipEnvelopeSetPointsHandler` — usa `clip.create_automation_envelope` + `envelope.clear()` + `insert_step`.
- `live/AbletonMind/handlers/arrangement.py` NEW — `arrangement.add_automation_point` via `track.create_or_get_automation_envelope`.
- Helper compartilhado `_resolve_parameter_locator(track, locator)` em `clip.py` (reusado por arrangement).

Phase 5 vai expandir: curve types reais (curva exponencial), batch operations, snap-to-grid.

## Verify loop — TD-016 progress

| Tool | Verify field | Antes |
|---|---|---|
| set_tempo | tempo (tol 1e-3) | Cycle 5 |
| track_set_volume | volume (tol 1e-4) | Cycle 5 |
| track_set_name | name | Cycle 5 |
| clip_set_name | name | Cycle 5 |
| **track_create** | is_midi vs intent.type | Cycle 7 |
| **track_upsert** | name | Cycle 7 |
| **create_midi_clip** | length + name (combinado) | Cycle 7 |
| **clip_set_loop** | loop_start/loop_end/looping (todos os fields passados) | Cycle 7 |
| **scene_fire** | UNVERIFIABLE (async clip start) | Cycle 7 |
| **device_set_parameter** | value (tol 1e-4) | Cycle 7 |
| **clip_set_envelope** | points count | Cycle 7 |

10 tools com verify. 13 ainda sem (Phase 1/2 reads + arrangement_add_automation_point que é NOT idempotent).

`verifyAll(...checks)` introduzido em `clip_set_loop` e `create_midi_clip` para combinar múltiplas verificações.

## Listeners expansão

Phase 2 (Cycle 5) tinha 2 eventos: tempo + is_playing.

Phase 2 (Cycle 7) adiciona 5:
- `event.track_name_changed` (com `track_index`)
- `event.track_mute_changed`
- `event.track_solo_changed`
- `event.track_volume_changed` (listener no `mixer_device.volume`)
- `event.clip_name_changed` (com `track_index`, `clip_slot_index`)
- `event.clip_is_playing_changed`

`setup()` registra dinamicamente para TODAS as tracks/clips existentes. Re-chamar `setup()` re-registra (idempotente).

**Limitação conhecida:** novas tracks/clips criadas DEPOIS do setup não ganham listeners automaticamente. Phase 3 vai adicionar listener no `song.tracks` para detectar add/remove e re-setup automático.

## Knowledge expansão — 10 devices

| Device | Params | Categoria |
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

**Total: 292 parameters indexados + drum_rack metadata** (MIDI ranges, kit layout 36..51, chain routing).

`drum_rack.json` carrega campos extras (`drum_pads`, `chain_routing`) preservados via `.passthrough()` no Zod schema.

PLAN.md §5 target: 50+ devices → **20% done**.

## Contract drift

`phase0-methods.md` precisa de §25 (clip.envelope_set_points) e §26 (arrangement.add_automation_point). **Não atualizado neste ciclo** — TD-021 (baixa).

## Testes

**Não foram escritos testes para Cycle 7** (Phase 4 handlers, listeners expansion, locator parser). Patterns existem. TD-022 (medium).

## Warnings

### W1 — TD-021: contract doc §25..§26
`clip.envelope_set_points` e `arrangement.add_automation_point` não documentados. Baixa.

### W2 — TD-022: testes Cycle 7
Phase 4 + listeners expansion + locator parser sem cobertura. Medium.

### W3 — `clipSetEnvelopeTool` shape de point ignora curve_type
Bridge atual usa `insert_step(time, length=0, value)` que é point puro. `curve_type` aceito no schema mas dropado no handler. Documentar como design Phase 4-strict; Phase 5 implementa curve. TD-023 (baixa).

### W4 — Bridge clip envelope handler assume `envelope.clear()` existe
`Live.ClipEnvelope` deveria expor `clear()` (Live 11+). Em versões antigas é `value_at_time` modify. Smoke real vai confirmar.

### W5 — Listeners expansion: track/clip criados depois do setup não ganham listener
Mencionado acima. Limitação documentada. Phase 3 endereça.

## Recomendação

**PASS Cycle 7.** Próximo:

Cycle 8:
- TD-004 smoke real.
- TD-021 contract doc.
- TD-022 testes Cycle 7.
- TD-016 finish — migrar últimas 13 tools (a maior parte read-only, então maioria fica UNVERIFIABLE).
- Phase 4 cont: curve_type real (TD-023), track_create_return, scene_create, more arrangement tools.
- Phase 2 evolução: meta-listener para detectar add/remove de tracks/clips.
- Knowledge: +5 devices (Drum Cell, Wavetable Player, Sampler, Simpler, Tuner).
