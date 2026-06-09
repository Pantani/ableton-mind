# Cycle 4 — 2026-06-09

**Fase PLAN.md:** Phase 1 (Paridade ahujasid) avançando — alvo ~18/22 tools no fim deste ciclo.
**Objetivo:** fechar débitos do Cycle 3 (TD-008..011), adicionar 3 tools (`get_track_info`, `fire_scene`, `set_clip_loop`), fundar o verify loop. TD-012 (completar Wavetable) e tools `load_instrument`/`set_device_parameter` ficam Cycle 5.

## Estratégia

Inline pelo architect — patterns 100% estabelecidos, sem motivo para dispatch de agente em background. Auto mode segue.

## Atribuições inline

### Trilha A — Bridge Python
1. 3 handlers novos: `track.get_info` (get_track_info detalhado), `scene.fire`, `clip.set_loop`.
2. Schemas + fakes correspondentes.
3. TD-009: testes para os 8 handlers do Cycle 3 que ficaram sem cobertura.

### Trilha A — Server TS
1. 3 tools MCP mapeando os handlers acima.
2. `src/feedback/verify.ts` — utilitário genérico para verify loop (lê estado após mutação, compara com intent, devolve `{ ok, diff }`).
3. Integrar verify no handler de `track_set_volume` como prova de conceito.
4. TD-010: testes para os 9 tools do Cycle 3 que ficaram sem cobertura.

### Trilha B — Knowledge
1. TD-011: parser real do `.adv` em `scripts/extract-device-schemas.mjs` (gunzip + sax-lite).
2. Salvar 1 device como prova: rodar contra `Default.adv` do Wavetable se existir; se não, gerar `src/knowledge/devices/_extracted/sample.json` com dados sintéticos.

### Trilha D — Distribuição
Sem ação inline (build:dxt está OK até virem mudanças de packaging). Cycle 5 vai precisar listar packs em manifest se o usuário pedir.

### Architect
1. TD-008: §10..§16 em `_workspace/contracts/phase0-methods.md` documentando os 9 métodos do Cycle 3.
2. `ADR-0005` se a forma do verify loop precisar de decisão registrada.

## Contratos novos

- `track.get_info` — read-only, detalhado por track (nome, color, mute/solo/arm, volume, pan, num_sends, num_clips, num_devices, current_input/output_routing).
- `scene.fire` — dispara uma cena por index.
- `clip.set_loop` — `{track_index, clip_slot_index, loop_start?, loop_end?, looping?}`. Idempotente.

## Dependências

- Verify loop precisa ler estado pós-mutação → reutiliza `track.get_info` para volume verify; outras tools podem mockar.
- Parser .adv não bloqueia tools — só popula knowledge.

## Critérios de gate

- [ ] TD-008..011 fechados.
- [ ] 3 handlers + 3 tools registrados.
- [ ] `src/feedback/verify.ts` existe com pelo menos 1 caller real.
- [ ] PROGRESS.md atualizado refletindo 18/22 tools.

## Próximo ciclo

Cycle 5:
- Fechar paridade ahujasid total: `load_instrument` + `get/set_device_parameter` (knowledge-aware).
- 4 devices: Operator, EQ Eight, Compressor, Reverb.
- Completar Wavetable (TD-012).
- Smoke real (TD-004).
- Phase 2 começa: listeners → MCP notifications.
