# Cycle 5 — 2026-06-09

**Fase PLAN.md:** fechar Phase 1 (paridade ahujasid 22/22) + Phase 2 começa (listeners → MCP notifications).
**Objetivo:** 3 tools knowledge-aware (`load_browser_item`, `get_device_parameters`, `set_device_parameter`); verify loop integrado em 4 tools (TD-013); Wavetable expandido (TD-012); listeners scaffold com 2 listeners e ADR-0005.

## Estratégia

Inline. Patterns 100% maduros. Auto mode.

## Atribuições

### Trilha A — Bridge Python
1. 3 handlers: `browser.load_item`, `device.get_parameters`, `device.set_parameter`.
2. `listeners.py` — registra listeners LiveAPI (tempo, is_playing) e empurra notifications via `bridge.broadcast(method, params)`.
3. `bridge.py` ganha método `broadcast(method, params)` que serializa JSON-RPC notification e escreve em todos os sockets conectados.
4. Schemas correspondentes.
5. Testes para os 3 handlers + smoke do listener (manual trigger).

### Trilha A — Server TS
1. 3 tools mapeando os handlers.
2. `src/tools/device.ts` novo (get/set device parameter — usa `loadDevice()` da knowledge para resolver name → index).
3. `src/tools/browser.ts` ganha `browser_load_item`.
4. Integrar `verifyField()` em 4 tools (TD-013).
5. Cliente TCP já emite `notification` event (Cycle 1) — apenas formalizar bridge → MCP notification em `src/server/index.ts`.

### Trilha B — Knowledge
1. TD-012: Wavetable.json completo (~50 params curados manualmente, alinhados com Live 12).
2. Validar via `loadDevice("wavetable")` (Zod parse passa).

### Trilha — Docs / ADR
1. ADR-0005 — formato de notifications e nomes de eventos.

## Contratos novos

- `browser.load_item` — `{ path: string[] }` → `{ loaded: bool, name: string }`. Carrega item do browser na track armada (LiveAPI: `application().browser.load_item(item)`).
- `device.get_parameters` — `{ track_index: number; device_index: number }` → `{ device_name, parameters: [...] }`. Knowledge-aware: enriquece com names canônicos quando disponível.
- `device.set_parameter` — `{ track_index, device_index, name?: string, index?: number, value: number }` → idempotente. `name` resolvido via knowledge antes de chamar bridge.
- `event.transport_tempo_changed` — `{ tempo: number }`.
- `event.transport_is_playing_changed` — `{ is_playing: boolean }`.

## Critérios de gate

- [ ] Paridade ahujasid 22/22.
- [ ] TD-012, TD-013 fechados.
- [ ] ADR-0005 escrito.
- [ ] 2 listeners ativos no bridge.
- [ ] PROGRESS.md atualizado.

## Próximo

Cycle 6: smoke real (TD-004) + Phase 3 (mais devices: Operator, EQ Eight, Compressor, Reverb) + Phase 2 expansão de listeners (track.* + clip.*).
