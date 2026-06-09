# Cycle 3 — 2026-06-09

**Fase PLAN.md:** Phase 1 (Paridade ahujasid) em andamento. Phase 0 fechada em código (smoke real ainda dependente de execução manual do usuário).

**Objetivo:** expandir cobertura LOM com 8 novas tools (clip mutators, track set_name/volume, session info, browser categories), fechar TD-006/TD-007, knowledge curator entra com Wavetable, distribution entrega `npm run build:dxt`.

## Estratégia

Execução **inline pelo architect** (mesma decisão dos Cycles 1-2 — agentes em background têm histórico de API error e o trabalho deste ciclo é majoritariamente arquivos pequenos seguindo patterns já estabelecidos).

## Atribuições inline

### Trilha A — Bridge Python
1. **TD-007:** `track.upsert` handler em `handlers/track.py` (idempotente; cria só se name=X não existir).
2. **8 handlers novos:**
   - `clip.add_notes` — adiciona array de MIDI notes a um clip existente (transacional).
   - `clip.fire` — dispara um clip slot.
   - `clip.stop` — para o clip tocando num clip slot.
   - `clip.set_name` — renomeia um clip.
   - `track.set_name`
   - `track.set_volume` (em dB ou 0..1? — ADR decide)
   - `session.get_info` — read-only, retorna {num_tracks, num_returns, has_master, tempo, time_signature, is_playing, song_time, name}.
   - `browser.get_categories` — read-only, lista as categorias do Live Browser.
3. Schemas em `schemas.py`.
4. Testes em `tests/test_handlers_*.py` para cada.

### Trilha A — Server TS
1. **TD-006:** documentar invariante `master_track` no JSDoc da tool `track_list`.
2. 9 tools MCP novas (as 8 acima + `track_upsert`):
   - `track_upsert`, `track_set_name`, `track_set_volume` → `src/tools/track.ts`
   - `clip_add_notes`, `clip_fire`, `clip_stop`, `clip_set_name` → `src/tools/clip.ts`
   - `session_get_info` → `src/tools/session.ts` (novo)
   - `browser_get_categories` → `src/tools/browser.ts` (novo)
3. Atualiza `src/tools/index.ts` registry.
4. Testes em `tests/tools-*.test.ts`.

### Trilha B — Knowledge (entra agora)
1. `src/knowledge/devices/wavetable.json` — schema parcial do Wavetable (parâmetros visíveis no UI primeiro plano: Osc1 Position, Osc2 Position, Filter Freq, Env1 A/D/S/R, etc).
2. `src/knowledge/index.ts` — loader que devolve devices/scales/grooves.
3. `src/knowledge/scales.json` — bootstrap básico (Major/Minor/Dorian/Phrygian/Lydian/Mixolydian/Aeolian/Locrian + root notes).
4. `scripts/extract-device-schemas.mjs` — STUB com lookup de `Default.adv` no User Library + parser XML rudimentar + warning de "TODO complete".

### Trilha D — Distribuição
1. `scripts/build-dxt.mjs` — junta `dist/`, `dxt/manifest.json`, `README.md`, `LICENSE`, opcionalmente `src/knowledge/`, num `.mcpb` zip.
2. `package.json` `scripts`: `"build:dxt": "node scripts/build-dxt.mjs"`.

## Contratos novos

### ADR-0003 — formato de MIDI note no `clip.add_notes`
Decidido: `{ pitch: 0-127, velocity: 0-127 default 100, start: float beats, duration: float beats, mute: bool default false }`. Mapeia direto para Live 11+ `clip.add_new_notes` (sem MPE per-note CC nesta fase; Phase 4 adiciona).

### ADR-0004 — escala do `track.set_volume`
Decidido: `volume: 0.0..1.0` (normalized, como expõe a LiveAPI `track.mixer_device.volume.value`). Conversão para dB fica em helper TS opcional.

## Dependências

- Knowledge não bloqueia nada nesta fase (pure data).
- Distribution depende de `dist/index.js` existir (build TS rodando) — mas o script só falha em runtime quando rodado.
- `clip.add_notes` depende de `clip.create_midi` existir (já existe).
- `track.upsert` reutiliza `track.create` internamente.

## Critérios de gate

- [ ] TD-006/TD-007 fechados.
- [ ] 8 handlers + 9 tools registrados, com testes mock-only.
- [ ] Knowledge: Wavetable.json + scales.json existem; loader compila.
- [ ] `scripts/build-dxt.mjs` existe (não precisa rodar com sucesso no sandbox — só `node --check` passar).
- [ ] ADR-0003 e ADR-0004 registrados.
- [ ] PROGRESS.md atualizado.

## Próximo ciclo

- Phase 1 cont.: tools restantes do ahujasid (~6) + verify loop genérico.
- Knowledge: Operator + Drum Rack + 5 audio effects (Reverb, EQ Eight, Glue, Auto Filter, Compressor).
- Smoke real (TD-004 ainda aberto) — usuário ou QA roda.
