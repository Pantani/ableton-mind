# QA Report — Cycle 15

**Data:** 2026-06-09
**Veredito:** **PASS-WITH-WARNINGS**

## Resumo

TD-041 fechado. Knowledge atinge **45/50 = 90%** PLAN.md §5. Recipes 12. Versão 0.0.15.

**Bloqueio para tag v0.1.0-rc.1: TD-004 (smoke real) — depende do usuário.**

## Tech debt

| ID | Status |
|---|---|
| TD-004 | 🟡 PENDENTE (usuário) — BLOQUEIA rc.1 |
| TD-005 | 🟡 PENDENTE (sandbox) |
| TD-030 | 🟡 PENDENTE (Push hardware) |
| TD-041 (knowledge units convention) | ✅ FECHADO — `src/knowledge/README.md` |

**1 fechado. Aberto: TD-004/005/030 (todos de ambiente real).**

## TD-041 — Knowledge units convention

`src/knowledge/README.md` documenta:
- Estrutura do schema completo.
- **Tabela de 16 unit types canônicos** (linear, curve, Hz, dB, s, ms, semitones, cents, octaves, MIDI, °, Q, %, BPM, bits, enum, bool, voices/count, ratio).
- **Regra `linear` vs `curve`**: linear espelha exatamente o slider; curve é 0..1 visual mas engine aplica curva não-linear → 0.5 ≠ "metade audível".
- Processo de adicionar device: extract → curador → KNOWN_DEVICES → tests.

Aplicado já em Cycle 15: Drum Buss Drive (Cycle 14) precedeu mas agora `Dynamic Tube::Drive` e `Dynamic Tube::Bias` usam `unit: "curve"` explícito. Devices anteriores ficam carry-over de re-anotação (TD-042 baixa).

## Knowledge — 45 devices (90% PLAN.md §5) 🎯

Novos Cycle 15: Cabinet (guitar IR sim), Dynamic Tube (3-type sat com curve units), Filter Delay (3 lines L/L+R/R), Grain Delay (granular pitch/spray), Utility (essential mixing).

## Recipes — 12

Novos Cycle 15:
- `drums/jungle-break` — Amen-style 170 BPM, kick + snare ghost + hat off-beat, 16 notes.
- `bass/reese` — Operator detuned saws (A+B level 0.7) + Filter LP24 + Chorus-Ensemble. D&B / neurofunk.

Drums e Bass agora têm 2 recipes cada (era 1).

## Total tools MCP: 31 (sem mudança)

## Versão: 0.0.15

`package.json` + `dxt/manifest.json` + CHANGELOG sync.

## Warnings

### W1 — Devices anteriores não re-anotados com `unit: "curve"` quando aplicável
TD-042 (baixa): Drum Buss, Pedal, Roar, Saturator têm Drive/Amount usando `unit: "linear"` mas engine é não-linear. Re-curadoria progressiva em Cycle 16+.

### W2 — TD-004 continua bloqueando rc.1
Nenhuma ação possível no sandbox.

## Recomendação

**PASS Cycle 15.** Próximo:

Cycle 16:
- **TD-004 smoke real** (BLOQUEIO).
- TD-042 re-anotação curve units.
- Tag `v0.1.0-rc.1` (após smoke PASS).
- +5 devices → meta 50/50 (100%).
- +2 recipes.
- Commit + push.
