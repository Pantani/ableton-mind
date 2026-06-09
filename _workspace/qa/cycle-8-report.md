# QA Report — Cycle 8

**Data:** 2026-06-09
**Veredito:** **PASS-WITH-WARNINGS**
**QA:** architect inline.

## Resumo

Cycle 8 fechou **5 débitos técnicos** (TD-016, TD-019, TD-021, TD-022, TD-023). Verify loop agora cobre **23/23 tools**. Knowledge salta para **15 devices / 360+ params**. Phase 4 ganha curve_type real.

Tech debt aberto reduzido para 2 itens — ambos dependentes de ambiente real (smoke + npm install).

## Tech debt status

| ID | Status |
|---|---|
| TD-004 (smoke real) | 🟡 PENDENTE (usuário) |
| TD-005 (npm install) | 🟡 PENDENTE (sandbox) |
| TD-016 (verify carry-over) | ✅ FECHADO — 23/23 tools (read-only declarativo; mutators com verifyField; async marcados UNVERIFIABLE) |
| TD-019 (SDK internals) | ✅ FECHADO — `src/server/_mcp-internals.ts` + adapter `getServerNotifier` |
| TD-021 (contract doc §25-26) | ✅ FECHADO |
| TD-022 (testes Cycle 7) | ✅ FECHADO — `tests/tools-locator-and-phase4.test.ts` + `live/.../tests/test_cycle7_phase4.py` |
| TD-023 (curve_type) | ✅ FECHADO — `clip.envelope_set_points` implementa `hold` via 2-step split |

**5 fechados / 2 abertos** (ambos não-resolvíveis em sandbox).

## Verify loop — 23/23 ✅

| Tool | Verify | Cycle |
|---|---|---|
| set_tempo | tempo (1e-3) | 5 |
| track_set_volume | volume (1e-4) | 5 |
| track_set_name | name | 5 |
| clip_set_name | name | 5 |
| track_create | is_midi | 7 |
| track_upsert | name | 7 |
| create_midi_clip | length+name | 7 |
| clip_set_loop | loop fields | 7 |
| device_set_parameter | value (1e-4) | 7 |
| clip_set_envelope | points count (com hold) | 7+8 |
| clip_add_notes | added count | 8 |
| **read-only**: track_list, track_get_info, session_get_info, browser_get_categories, browser_load_item, device_get_parameters | inherently verified (no mutation) | 8 |
| **async**: play, stop, scene_fire, clip_fire, clip_stop | UNVERIFIABLE sentinel | 5-8 |
| arrangement_add_automation_point | (NOT idempotent, bridge confirma add) | 7 |

Cobertura completa. Cada tool tem decisão registrada — verify real / declarativo / UNVERIFIABLE.

## Phase 4 — curve_type implementado (TD-023)

Bridge `clip.envelope_set_points`:
- `linear` (default) / `ramp`: 1 step puro.
- `hold` (a partir do 2º point): insere 2 steps — edge value@previous a `time-1e-4` + `value@time`. Cria a borda de step característica do hold.

TS tool `clip_set_envelope` calcula `expectedCount = sum(1 + isHoldAfterFirst(p) ? 1 : 0)` para verify.

Testes Python `test_cycle7_phase4.py::TestClipEnvelopeSetPoints::test_hold_curve_type_inserts_extra_step` confirma.

## SDK adapter — TD-019

`src/server/_mcp-internals.ts` centraliza TODO acesso a internals:
- `getServerNotifier(server) → ServerNotifier`
- `SdkIncompatibilityError` quando shape do SDK mudar

`notifications.ts::createMcpNotifier` agora delega 1 linha. Se SDK 2.x mover `.server.notification` para outro caminho, só 1 arquivo precisa atualizar.

Testes: `tests/tools-locator-and-phase4.test.ts::getServerNotifier` cobre happy path + 3 cenários de incompatibilidade.

## Contract doc

§1..§26 completos:
- §25 `clip.envelope_set_points` (locator + points + curve_type)
- §26 `arrangement.add_automation_point`
- Resumo final lista 23 tools por categoria.

## Knowledge — 15 devices / ~360 params

Novos Cycle 8:
| Device | Params | Categoria |
|---|---|---|
| Drum Cell | 16 | instrument (Live 12+) |
| Simpler | 23 | instrument |
| Sampler | 17 (parcial) | instrument |
| Tuner | 4 | audio_effect |
| Phaser-Flanger | 14 | audio_effect (Live 11+ unified) |

Total acumulado: **15 devices**, **~360 parameters** indexados + drum_rack metadata.

PLAN.md §5 target 50+ devices → **30% done**.

## Testes

Python:
- `test_cycle7_phase4.py` NEW: 11+ casos cobrindo Phase 4 handlers + locator + listeners expansion.

TS:
- `tools-locator-and-phase4.test.ts` NEW: 17+ casos cobrindo locator parser (6 vars), arrangement+envelope tools (5), SDK adapter (4), UNVERIFIABLE behavior (4).

## Warnings

### W1 — Sampler parcial
17/~80 params. Marcado `completeness: partial` com TODO. Não bloqueia uso de Sampler via knowledge (LLM ainda recebe enriquecimento para os params curados). TD-024 (baixa).

### W2 — Live mock para Cycle 8 Python tests
`test_cycle7_phase4.py::TestListenerManagerExpansion` adiciona métodos `add_*_listener` dinamicamente nos fakes. Padrão funciona mas é frágil — Phase 9 pode mover esse setup para `_fakes/live_api.py` como helper. TD-025 (trivial).

### W3 — Phase 5 não iniciada
PLAN.md §12 lista Phase 5 (preview / render) como próxima major. Cycle 9 deve abrir.

## Recomendação

**PASS Cycle 8.** Tech debt back-to-back essencialmente zerado (só TD-004/005 abertos, ambos de ambiente).

Próximo (Cycle 9):
- TD-004 smoke real.
- Phase 5 start: `render_preview` (8-bar bounce) + `screenshot_live` + session snapshot.
- Knowledge: +5-10 devices (Bass, Drift, Meld, Beat Repeat, Erosion, Frequency Shifter, Glue Compressor, Hybrid Reverb, Limiter, Vocoder).
- Recipes (Trilha C): primeira recipe entregue (`drums/tech-house-kick.json` como prova de conceito).
- TD-024 (Sampler complete), TD-025 (mock helper).
