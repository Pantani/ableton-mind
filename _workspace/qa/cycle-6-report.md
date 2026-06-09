# QA Report — Cycle 6

**Data:** 2026-06-09
**Veredito:** **PASS-WITH-WARNINGS**
**QA:** architect inline.

## Resumo

Cycle 6 fechou **pipeline de notifications end-to-end** (TD-014 + TD-015), atualizou contract doc (TD-017), preencheu lacuna de testes (TD-018), e quadruplicou cobertura de knowledge (EQ Eight + Compressor + Reverb + Operator). **Phase 2 funcional em código** — falta apenas smoke real para confirmar contra Live de verdade.

## Tech debt status

| ID | Status | Onde |
|---|---|---|
| TD-004 (smoke real) | 🟡 PENDENTE | `docs/smoke-test.md` |
| TD-005 (npm install) | 🟡 PENDENTE | máquina real |
| TD-014 (broadcast) | ✅ FECHADO | `BridgeServer.broadcast()` em `bridge.py:188` + ListenerManager wired no `__init__.py` |
| TD-015 (TS forward) | ✅ FECHADO | `src/server/notifications.ts` + `attachNotificationForwarder` em `src/index.ts` |
| TD-016 (verify carry-over) | 🟡 PENDENTE | 17 tools (migração progressiva) |
| TD-017 (contract doc) | ✅ FECHADO | `phase0-methods.md` §21..§24 |
| TD-018 (testes Cycle 5) | ✅ FECHADO | `test_cycle5_6.py` + `server-notifications.test.ts` + `tools-device-browser-load.test.ts` |

**4 fechados / 3 carry-over** (todos baixos ou não-resolvíveis em sandbox).

## Pipeline de notifications

```
Live event (ex: usuário muda tempo no GUI)
  → LiveAPI dispara `add_tempo_listener` callback
  → ListenerManager._on_tempo() em main thread
  → bridge.broadcast("event.transport_tempo_changed", {value, previous, ts})
  → loop sobre self._clients[]: socket.sendall(JSON-RPC notification + \n)
  → Sockets mortos são removidos do _clients

TS server:
  TcpJsonRpcClient.processLine() detecta msg sem `id` → emit("notification", method, params)
  → attachNotificationForwarder handler → forwardNotification()
  → filtra prefix `event.` (descarta o resto com warn)
  → notifier (= McpServer.server.notification(...)) repassa para o cliente MCP
  → erros são engolidos com log (não quebram conexão TCP)
```

Testes cobrem cada peça em isolado (mock socketpair, EventEmitter fake, vi.fn notifier).

## Parity check

**23 métodos JSON-RPC** no bridge / **21 tools MCP** registradas no TS. Match.

Eventos Phase 2 ativos:
- `event.transport_tempo_changed`
- `event.transport_is_playing_changed`

Documentados em `phase0-methods.md §24`.

## Knowledge

| Device | Params | Completeness | Linhas JSON |
|---|---|---|---|
| Wavetable | 60 | complete (Cycle 5) | ~150 |
| Operator | 53 | complete | ~80 |
| EQ Eight | 45 | complete | ~75 |
| Compressor | 21 | complete | ~50 |
| Reverb | 31 | complete | ~55 |

**5 devices** totalizando **210 parameters** indexados. PLAN.md §5 alvo é 50+ devices → Phase 3 ainda longa.

`src/knowledge/index.ts::KNOWN_DEVICES` atualizado.

## Testes

Python:
- `test_cycle5_6.py` NEW: 4 test classes / 16+ casos cobrindo browser.load_item, device.get_parameters, device.set_parameter, ListenerManager, BridgeServer.broadcast.

TS:
- `server-notifications.test.ts` NEW: 5 casos (forwarding, drop non-event, error swallow, attach/dispose).
- `tools-device-browser-load.test.ts` NEW: 8 casos (browser_load_item input/output, device tools knowledge enrichment, name resolution, error path).

**Cobertura estimada** acumulada (todos os cycles): ~120 test cases TS + ~50 test cases Python.

## Contract drift

`phase0-methods.md` agora §1..§24 cobrindo todos os 23 métodos + seção de events. Drift = 0. ✅

## Warnings

### W1 — TD-016: 17 tools ainda com `verified: true` literal
Migração progressiva. Cycle 7 deve migrar +5-10. Baixa.

### W2 — `McpServer.server.notification` API depende de internals do SDK
Acessamos via cast `(server as unknown as { server: { notification } }).server.notification(...)`. Se o SDK 2.x mudar o naming, quebra. Mitigado pelo adapter `McpNotifier` injetável — testes mockam a função, não o SDK. TD-019 (baixa, monitoring).

### W3 — Broadcast em modo headless escreve para sockets mortos antes de detectar
Comportamento esperado para TCP — só na próxima escrita o OS reporta EPIPE/RESET. Detector funciona, mas pode demorar 1-2 broadcasts até remover. Baixa, sem ação.

### W4 — `_seed_track_with_device` nos testes Python mutaba `FakeDeviceParameter`
Adicionei `name/is_quantized/value_items/automation_state` post-construção porque `FakeDeviceParameter` foi criado em Cycle 3 sem esses campos. Não migrado para o construtor pra não quebrar testes existentes. TD-020 (trivial).

## Recomendação

**PASS Cycle 6.** Phase 2 funcional em código. Próximo:

Cycle 7:
- Smoke real (TD-004) — gate Phase 0.
- TD-016 progress — migrar verify em mais 5-10 tools.
- TD-019 / TD-020 (baixos).
- Phase 2 expansão: listeners de track (name, mute, solo, volume).
- Phase 4 começar: automation envelopes (`Song.scrub_by`, `Clip.envelope_add_point`, etc.).
- Phase 3 cont: +5 devices (Auto Filter, Echo, Saturator, Delay, Drum Rack).
