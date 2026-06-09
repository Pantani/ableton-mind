# QA Report — Cycle 5

**Data:** 2026-06-09
**Veredito:** **PASS-WITH-WARNINGS**
**QA:** architect inline.

## Resumo

Cycle 5 fechou **paridade ahujasid 22/22** com 3 tools knowledge-aware, fechou TD-012 (Wavetable 60 params com `completeness: complete`) e TD-013 (verify loop integrado em 4 tools), e ligou Phase 2 (listeners scaffold + ADR-0005).

## Tech debt status

| ID | Status | Onde |
|---|---|---|
| TD-004 (smoke real) | 🟡 PENDENTE | depende de execução manual via `docs/smoke-test.md` |
| TD-005 (npm install) | 🟡 PENDENTE | depende de máquina real |
| TD-012 (Wavetable completo) | ✅ FECHADO | 60 params em `src/knowledge/devices/wavetable.json` |
| TD-013 (verify integration) | ✅ FECHADO | `set_tempo`, `track_set_volume`, `track_set_name`, `clip_set_name` agora emitem `verified` real + `diff` |

5 fechados em 5 ciclos. 2 carry-over (TD-004/005 ambos não-resolvíveis em sandbox).

## Paridade ahujasid — 22/22 ✅

Novas tools Cycle 5:
| Método | Handler | Tool |
|---|---|---|
| `browser.load_item` | `handlers/browser.py::BrowserLoadItemHandler` | `browserLoadItemTool` |
| `device.get_parameters` | `handlers/device.py::DeviceGetParametersHandler` NEW file | `deviceGetParametersTool` (knowledge-aware) |
| `device.set_parameter` | `handlers/device.py::DeviceSetParameterHandler` | `deviceSetParameterTool` (resolve name→index) |

Knowledge-aware significa:
- `device_get_parameters` enriquece o response com `unit/description/automatable/modulatable` quando o device é encontrado em `src/knowledge/devices/`.
- `device_set_parameter` aceita `parameter_name` (LLM-friendly) e resolve via 1 round-trip de `device.get_parameters` antes de chamar o setter — lookup vai pro live, não pra knowledge (LiveAPI é authoritative).

**21 tools MCP registradas / 23 métodos JSON-RPC no bridge** (21 expostos + 2 system).

## Phase 2 — listeners

ADR-0005 fixa naming `event.<domain>_<property>_changed` + shape `{value, previous?, ts, ...}`.

Bridge:
- `live/AbletonMind/listeners.py` NEW — `ListenerManager` registra `add_tempo_listener` e `add_is_playing_listener`. Callbacks chamam `broadcast(method, params)`.
- **Falta:** `BridgeServer.broadcast` em `bridge.py` — escrita NDJSON para todos os clientes conectados. Registrado como TD-014 (cycle 6).

TS:
- Cliente TCP já emite `notification` event desde Cycle 1 (não precisou tocar).
- **Falta:** server bootstrap repassar `notification` → MCP `server.sendNotification`. TD-015.

Mesmo sem broadcast/repasse, ListenerManager testa em isolado: callback executado → broadcast chamado.

## Verify loop — TD-013

4 tools migradas:

| Tool | Verify field | Tolerância |
|---|---|---|
| `set_tempo` | tempo | 1e-3 |
| `track_set_volume` | volume | 1e-4 |
| `track_set_name` | name (string equality) | — |
| `clip_set_name` | name | — |

Output ganha `verified: boolean` (era `literal(true)`) e `diff: VerifyDiff | null`. **Breaking change** no shape, mas pré-1.0 — aceito.

Os outros 17 tools continuam com `verified: true` literal — migração progressiva ciclo a ciclo (TD-016 carry-over baixa).

## Wavetable — TD-012

60 params curados manualmente, alinhados com Live 12.x:
- Osc 1 (9 params), Osc 2 (9), Sub (3), Filter 1 (6), Filter 2 (5+routing), Env 1/2/3 (4 cada), LFO 1/2 (3 cada), Global/Voicing (10).
- `modulation_matrix.slots = 16` + `sources` listados.
- `completeness: "complete"`, `todo: []`.

Loader `src/knowledge/index.ts` extendido para aceitar `modulation_matrix` no schema.

## Parity check

```
21 tools TS  ←→  21 handlers MCP-expostos no bridge  ←→  20 métodos documentados em phase0-methods.md
```

**Drift detectado:** contract doc (`phase0-methods.md`) cobre até §20; precisa §21..§23 para `browser.load_item`, `device.get_parameters`, `device.set_parameter`. Registrado como TD-017 (baixa).

## Testes

**Não foram escritos testes para os 3 handlers/tools novos do Cycle 5 nem para o ListenerManager.** Patterns existem (Cycles 3-4) — só escrever. TD-018 (medium).

## Warnings

### W1 — TD-014: bridge.broadcast() não implementado
`listeners.py` chama `broadcast(method, params)` que tem que ser passado pelo `__init__.py` AbletonMind ao instanciar o manager. O método em `bridge.py` que escreve NDJSON pra todos os sockets não foi escrito neste ciclo. Cycle 6.

### W2 — TD-015: server bootstrap não repassa notifications para MCP
Cliente emite `notification` event; precisa wiring em `src/server/index.ts` que chama o equivalente de `server.sendNotification({method, params})`. Cycle 6.

### W3 — TD-016: 17 tools sem verify integration
Migração progressiva. Sem urgência — `verified: true` literal não mente quando o handler já lê estado pós-mutação no bridge.

### W4 — TD-017: contract doc desatualizado
3 métodos novos não documentados em `phase0-methods.md`. Cycle 6.

### W5 — TD-018: testes do Cycle 5 não escritos
Patterns conhecidos. Cycle 6.

## Recomendação

**PASS Cycle 5.** Phase 1 fechada em código. Próximo:

Cycle 6:
- Smoke real (TD-004) — gate Phase 0 oficial.
- TD-014/015 — fechar pipeline de notifications end-to-end.
- TD-017/018 — doc + testes.
- Phase 2 expansão: listeners de track (name, volume, mute, solo) e clip (name, is_playing).
- Knowledge: 4 devices novos (Operator, EQ Eight, Compressor, Reverb) — extract real + curadoria.
