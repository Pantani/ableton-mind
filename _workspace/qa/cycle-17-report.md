# QA Report — Cycle 17

**Data:** 2026-06-09
**Veredito:** **PASS-WITH-WARNINGS**

## Resumo

TD-043 fechado. **Knowledge atinge 55 devices** (110% alvo PLAN §5 = 50). README PT atualizado. Versão 0.0.17.

**Bloqueio para tag v0.1.0-rc.1: TD-004 (smoke real) — depende do usuário.**

## Tech debt

| ID | Status |
|---|---|
| TD-004 | 🟡 PENDENTE (usuário) — BLOQUEIA rc.1 |
| TD-005 | 🟡 PENDENTE (sandbox) |
| TD-030 | 🟡 PENDENTE (Push hardware) |
| TD-043 (MIDI effects restantes) | ✅ FECHADO |

**1 fechado. Aberto: TD-004/005/030 (todos de ambiente real).**

## TD-043 — 5 MIDI effects

- **Chord** (12 params: 6 shift slots × 2: shift semitones + velocity offset).
- **Note Length** (7 params: length, sync, gate, on/off balance, decay).
- **Random** (5 params: chance, choices, scale, sign, mode).
- **Scale** (6 params: base, transpose, range lower/upper, fold, OOR mode). 12-cell grid não exposto (TODO Phase 8).
- **Velocity** (9 params: drive, compand, random, mode, range mapping).

Total MIDI effects cobertos: 7 (Pitch, Arpeggiator + os 5 acima). PLAN.md §4.16 ahujasid cobertura completa.

## Knowledge — 55 devices

Coverage map por categoria:
- **instrument** (8): Wavetable, Operator, Sampler, Simpler, Drum Cell, Bass, Drift, Meld.
- **audio_effect** (38): saturation/dist (6), dynamics (6), EQ (3), filter (1), modulation (5), delay (5), reverb (4), utility (8).
- **midi_effect** (7): Pitch, Arpeggiator, Chord, Note Length, Random, Scale, Velocity.
- **drum_rack** (1): Drum Rack (+drum_pads metadata).
- **TOTAL: 55 devices, ~800 parameters indexados.**

PLAN.md §5 target = 50+ → 110% ✅.

## Versão: 0.0.17

`package.json` + `dxt/manifest.json` + CHANGELOG sync.

## Total tools MCP: 31 (sem mudança)

## Warnings

### W1 — TD-004 ainda bloqueia rc.1
Nenhuma ação possível no sandbox.

### W2 — Scale device: 12-cell grid não exposto
A grade interativa do Scale UI mapeia pitch class → target. Não é param automatável. Phase 8 pode expor via LOM `scale_map` (TODO embarcado).

### W3 — External Audio Effect: routing strings
Input/Output routing são strings populadas pelo Live runtime — não exponíveis como knowledge estático. TODO embarcado.

## Recomendação

**PASS Cycle 17.** Sistema completo, knowledge >100% alvo. Próximo:

Cycle 18 (ou Release Window):
- **TD-004 smoke real** ← BLOQUEIO. Quando passar, tag `v0.1.0-rc.1`.
- Limpeza minor: tech-debt.md, agentes recap.
- Eventual v0.1.0 final após validação rc.1.
