# Cycle 7 — 2026-06-09

**Fase PLAN.md:** Phase 4 (automation envelopes) inicia. Phase 2 (listeners) expande. Phase 3 (knowledge) continua.

**Objetivo:** TD-020 trivial, TD-016 batch migration (6+ tools), 5 listeners novos (track + clip), 2-3 handlers/tools de automation, 5 device schemas novos, ADR-0006.

## Estratégia

Inline. Patterns 100% maduros.

## Atribuições

### Trilha A — Bridge
1. TD-020: `FakeDeviceParameter.__init__` recebe `name`, `is_quantized`, `value_items`, `automation_state`.
2. `ListenerManager` ganha track + clip listeners — registra dinamicamente para todas as tracks/clips existentes na hora do `setup()`. Eventos: `event.track_<i>_name_changed`, `track_<i>_volume_changed`, `track_<i>_mute_changed`, `track_<i>_solo_changed`, `clip_<t>_<s>_is_playing_changed`.
3. Handlers Phase 4: `clip.envelope_set_points` (lista de `(time, value)` num automation envelope dentro do clip), `arrangement.add_automation_point` (envelope no arrangement).

### Trilha A — Server TS
1. Migrar para verify loop: `track_create`, `track_upsert`, `clip_set_loop`, `scene_fire`, `device_set_parameter`, `create_midi_clip` (TD-016 → 10/21 tools migradas).
2. 2 tools novas Phase 4: `clip_set_envelope`, `arrangement_add_automation_point`.

### Trilha B — Knowledge
1. `auto_filter.json`, `echo.json`, `saturator.json`, `delay.json`, `drum_rack.json` (este último é macro: rack params + slot enumeration).
2. Atualizar `KNOWN_DEVICES`.

### Trilha — Architect
1. ADR-0006: shape de automation envelope (points como `Array<{time, value, curve_type?}>`, escala temporal em beats, valor sem normalização — usa o range nativo do param).

## Contratos

`clip.envelope_set_points`:
- request: `{ track_index, clip_slot_index, parameter_path: string, points: Array<{time, value, curve_type?}> }` — `parameter_path` resolve via knowledge na rota TS (ex: `"mixer.volume"`, `"device.0.Cutoff"`).
- response: `{ changed: true, replaced: number, points: number }`.

`arrangement.add_automation_point`:
- request: `{ track_index, parameter_path, time, value, curve_type? }`.
- response: `{ added: true, time, value }`.

## Critérios de gate

- [ ] TD-020 fechado.
- [ ] TD-016: 10/21 tools usando verify.
- [ ] 5 listeners novos no bridge ativos.
- [ ] 2 tools Phase 4 + handlers.
- [ ] 5 devices novos (10 total).
- [ ] ADR-0006 escrito.
- [ ] PROGRESS atualizado.

## Próximo

Cycle 8: smoke real (TD-004), TD-016 finish (resto das tools), expandir automation (curve_type variants), Phase 4 cont, +10 devices.
