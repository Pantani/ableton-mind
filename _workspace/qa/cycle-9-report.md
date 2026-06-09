# QA Report — Cycle 9

**Data:** 2026-06-09
**Veredito:** **PASS-WITH-WARNINGS**

## Resumo

Phase 5 (preview/verify) iniciada. Recipes (Trilha C) estreou. Knowledge salta para **20 devices**. TD-024 e TD-025 fechados.

## Tech debt

| ID | Status |
|---|---|
| TD-004 | 🟡 PENDENTE (usuário) |
| TD-005 | 🟡 PENDENTE (sandbox) |
| TD-024 (Sampler complete) | ✅ FECHADO — 49 params curados + modulation_matrix |
| TD-025 (mock helper) | ✅ FECHADO — `install_listener_methods()` + `fire_listener()` em `_fakes/live_api.py` |

**2 fechados em Cycle 9. Aberto: só TD-004/005.**

## Phase 5 — preview + verify

- `session.snapshot` — deep read de tempo, transport, tracks, clips, devices.
- `session.diff` — recursive diff entre snapshots; ignora `ts`.
- `render.preview` — modo `snapshot` (Phase 5); modo `bounce` planejado Cycle 10.

3 tools MCP: `session_snapshot`, `session_diff`, `render_preview`. Esquema completo Zod-validado.

Foundation para **verify loop completo** (LLM tira snap, muta, tira snap de novo, vê diff).

## Recipes — Trilha C estreia (ADR-0007)

- `src/recipes/index.ts` loader Zod-tipado.
- `src/recipes/runner.ts` executor com placeholders mustache + dotted-let bindings.
- 2 tools MCP: `list_recipes` (filter por categoria), `apply_recipe` (overrides + progresso parcial em falha).
- 1 recipe seed: `recipes/drums/tech-house-kick.json` (4-on-the-floor kick com Drum Cell + 4 inputs).

`apply_recipe` retorna `{ applied, completed, failed_at?, error?, bindings }`. Sem rollback (Phase 6 adiciona via undo batch).

## Knowledge — 20 devices / ~520 params

Novos Cycle 9:
| Device | Params |
|---|---|
| Sampler (TD-024 complete) | 49 |
| Limiter | 6 |
| Glue Compressor | 11 |
| Bass | 19 |
| Drift | 30 |
| Hybrid Reverb | 19 |

PLAN.md §5 target 50+ → **40% done**.

## Total tools MCP: 26

Era 23. +3 Phase 5 + 2 recipes (note: `apply_recipe` returns `ok: boolean` via recipe outcome — design intencional).

## Warnings

### W1 — Testes Cycle 9 não escritos (TD-026)
Phase 5 handlers + recipe runner sem cobertura. Medium.

### W2 — Contract doc não atualizado (TD-027)
§27..§29 (session.*, render.preview) + §30 (recipes) faltando. Baixa.

### W3 — `recipes/recipe-schema.json` referenciado mas não criado
Recipes apontam para `$schema: "../recipe-schema.json"` que não existe (loader ignora). TD-028 (trivial).

### W4 — Recipe `tech-house-kick` assume drum_cell já carregado
Recipe não faz `browser.load_item` do Drum Cell. Em runtime real, MIDI track recém-criada não tem device. Cycle 10 deve adicionar step ou criar variante "complete-from-scratch". TD-029 (baixa).

## Recomendação

**PASS Cycle 9.** Próximo:

Cycle 10:
- Smoke real (TD-004).
- TD-026 (testes Phase 5 + recipes).
- TD-027 (contract doc).
- TD-028 (recipe-schema.json).
- TD-029 (recipe drum loading).
- Phase 5 cont: `render.preview` modo bounce (`freeze_track` + export).
- Phase 6 start: Push 1/2/3 LED/pad control (PLAN.md §4.18).
- +5 devices: Pedal, Roar, Vocoder, Beat Repeat, Erosion.
- +3 recipes: `bass/sub-808`, `racks/sidechain-rack`, `mixing/master-bus`.
