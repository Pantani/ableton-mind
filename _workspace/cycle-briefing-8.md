# Cycle 8 — 2026-06-09

**Fase PLAN.md:** Phase 2 + 3 + 4 continuação. Limpeza de débitos antes do Phase 5.
**Objetivo:** fechar TD-016/019/021/022/023 (5 itens), +5 devices, deixar só TD-004/005 (dependentes de ambiente real) abertos.

## Estratégia

Inline.

## Atribuições

### Trilha A — Bridge
1. TD-023: `clip.envelope_set_points` aceita curve_type por ponto: `linear` (1 step), `hold` (2 steps: valor anterior até `time`, depois pula).
2. Testes consolidados Cycle 7 (TD-022) — `test_cycle7.py`.

### Trilha A — Server TS
1. TD-019: extrair acesso ao SDK internal num único módulo `_mcp-internals.ts` com 1 função `getServerNotifier(server)`. notifications.ts importa daí. Mais simples mockar / abstrair em SDK 2.x.
2. TD-016 finish: migrar todas as read-only tools (`track_list`, `track_get_info`, `session_get_info`, `browser_get_categories`, `browser_load_item`, `device_get_parameters`) para `verified: true` (declarativo — read-only é sempre verificável); `clip_add_notes` (idempotência por count); `clip_fire`/`clip_stop` (UNVERIFIABLE), `play`/`stop` (UNVERIFIABLE — transport state assíncrono). Total alvo: **23/23**.
3. Testes Cycle 7 TS: locator parser + sceneFireTool já existe, faltam arrangement + clip_set_envelope (mocked).

### Trilha B — Knowledge
1. `drum_cell.json`, `sampler.json`, `simpler.json`, `tuner.json`, `phaser_flanger.json`.
2. Atualizar `KNOWN_DEVICES`.

### Trilha — Architect
1. TD-021: §25 (clip.envelope_set_points) + §26 (arrangement.add_automation_point) em phase0-methods.md.

## Critérios de gate

- [ ] TD-016/019/021/022/023 fechados.
- [ ] 15 devices na knowledge (era 10).
- [ ] PROGRESS atualizado refletindo: 23/23 verify, 15 devices, Phase 4 com curve_type.

## Próximo

Cycle 9: smoke real (TD-004), Phase 5 começa (preview / render), Phase 3 expansão para 25-30 devices.
