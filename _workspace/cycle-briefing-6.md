# Cycle 6 — 2026-06-09

**Fase PLAN.md:** Phase 2 — listeners → MCP notifications (fechar pipeline end-to-end). Phase 3 — knowledge expansion (+4 devices).

**Objetivo:** terminar trilho de notifications (TD-014 + TD-015), atualizar contract doc (TD-017), preencher cobertura de testes (TD-018), curar EQ Eight / Compressor / Reverb / Operator.

## Estratégia

Inline. Patterns 100% maduros.

## Atribuições

### Trilha A — Bridge
1. `bridge.py::BridgeServer.broadcast(method, params)` — escreve NDJSON em todos os sockets conectados. Thread-safe (lock no `_clients`).
2. `__init__.py::AbletonMind` — instancia `ListenerManager` no `setup()` e chama `teardown()` no `disconnect()`.
3. Testes para `broadcast()` e wiring do ListenerManager (`tests/test_listeners.py`).

### Trilha A — Server TS
1. `src/server/notifications.ts` — wrapper que recebe `(method, params)` e chama `mcpServer.sendNotification`. Fail-soft se método não começa com `event.`.
2. `src/index.ts` — `client.on("notification", forwarder)`.
3. Testes (`tests/server-notifications.test.ts`) com mock McpServer.

### Trilha B — Knowledge
1. `src/knowledge/devices/eq_eight.json` — 8 bands (cada Freq/Gain/Q/On/Type) + Output Gain + Scale + Mode + 4 view params.
2. `src/knowledge/devices/compressor.json` — Threshold/Ratio/Attack/Release/Knee/Gain/Lookahead/Sidechain.
3. `src/knowledge/devices/reverb.json` — Room/Decay/Damping/Predelay/EarlyRefs/Diffusion/HighShelf/Wet/Stereo.
4. `src/knowledge/devices/operator.json` — 4 osc (Coarse/Fine/Level/Envelope/Wave) + Filter + Global + Algorithm.
5. Atualizar `KNOWN_DEVICES` em `src/knowledge/index.ts`.

### Trilha — Architect
1. TD-017: §21..§23 (browser.load_item, device.get_parameters, device.set_parameter) + §24 (events).

## Contratos

`browser.load_item`, `device.get_parameters`, `device.set_parameter` — já implementados Cycle 5, agora documentados.
`event.transport_*` — já em ADR-0005; documento o shape na seção §24 do contrato.

## Critérios de gate

- [ ] TD-014/015 fechados.
- [ ] TD-017 fechado (§21..§24).
- [ ] TD-018 fechado (testes cobrindo Cycle 5 + listeners + notification forwarder).
- [ ] 4 device JSONs adicionados + index atualizado.
- [ ] PROGRESS.md refletindo Phase 2 funcional end-to-end (em código).

## Próximo

Cycle 7: smoke real (TD-004), continuar verify integration (TD-016), Phase 4 (automation envelopes) começar.
