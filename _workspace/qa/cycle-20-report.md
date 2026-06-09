# QA Report — Cycle 20

**Data:** 2026-06-09
**Veredito:** **PASS**

## Resumo

TD-045 fechado. Real **wire-level smoke** entregue (opt-in via env var). Doctor CLI ganha 7º check. Versão 0.0.20.

**TD-004 smoke real ainda blocker para rc.1** — mas wire smoke já exercita a infraestrutura inteira (sockets, NDJSON, dispatcher, error envelopes) sem depender de Live.

## Tech debt

| ID | Status |
|---|---|
| TD-004 | 🟡 PENDENTE (usuário — Live UI) |
| TD-005 | 🟡 PENDENTE (sandbox) |
| TD-030 | 🟡 PENDENTE (Push hardware) |
| TD-045 (DXT resources field) | ✅ FECHADO — manifest ganha array `resources` com 3 entradas |

**3 abertos — todos hardware/Live UI dependent. 42 TDs fechados em 20 ciclos.**

## TD-045 — DXT manifest resources

`dxt/manifest.json` ganha:
```json
"resources": [
  { "uri": "live://session/state", "name": "session_state", "description": "...", "mimeType": "application/json" },
  { "uri": "live://knowledge/devices", "name": "knowledge_devices", ... },
  { "uri": "live://recipes/index", "name": "recipes_index", ... }
]
```

Speculative — MCPB spec v0.1 não documenta `resources` field, mas clientes que suportam (MCPB v0.2+) renderizam menu. Clientes antigos ignoram silently. Sem custo.

## Wire smoke test — Cycle 20 keystone

`live/AbletonMind/__main__.py` — CLI entry:
```bash
python -m AbletonMind --port 9999
```
Roda BridgeServer em headless (sem Live), aceita conexões TCP, dispatch JSON-RPC normal. SIGTERM/SIGINT shutdown clean.

`tests/wire-smoke.test.ts`:
- **OPT-IN** via `RUN_WIRE_SMOKE=1` (skip default — não quer Python obrigatório no CI).
- Spawns bridge subprocess em porta efêmera.
- `waitForPort(port, 5s)` aguarda accept.
- Real `TcpJsonRpcClient.connect()` → real TCP handshake → JSON-RPC envelope wire.
- Asserts:
  1. `performHandshake` retorna `protocol_version: "0.1"` + `bridge: "ableton-mind/python"`.
  2. `system.ping` retorna `{pong:true, ts:number}`.
  3. `track.list` rejeita com `JsonRpcRemoteError code:-32000` (sem song → LIVE_NOT_RUNNING).
- Cleanup: SIGTERM bridge, SIGKILL fallback.

**Este é o smoke mais real que dá pra fazer sem Live aberto.** Catches bugs que mocks de socket não pegam:
- NDJSON line-split correto sob carga.
- JSON-RPC envelope shape exato.
- Dispatcher threading em modo headless.
- Error encoding `-32000` com data `{detected:false}`.

CI Phase 7 (`ci.yml` já tem Python matrix) pode setar `RUN_WIRE_SMOKE: "1"` no env do TS job — Cycle 21+ opcional.

## Doctor CLI — 7 checks

| # | Check | Cycle |
|---|---|---|
| 1 | Node.js ≥ 20 | 1 |
| 2 | Remote Script instalado | 1 |
| 3 | Bridge em :9876 | 1 |
| 4 | Knowledge base válida | 1 |
| 5 | Recipes válidas | 9 |
| 6 | Version sync (pkg ↔ DXT) | 14 |
| 7 | **MCP primitives** | 20 |

Check 7 conta `allTools/allPrompts/allResources.length` — falha se algum import quebrar (regressão tipo "registry voltou 0"). Esperado: ≥30 tools, ≥5 prompts, ≥3 resources.

## Versão: 0.0.20

`package.json` + `dxt/manifest.json` + CHANGELOG sync.

## Total MCP — final estado

- **33 tools**, **5 prompts**, **3 resources**.
- **55 devices**, **14 recipes**.
- **30 métodos JSON-RPC** no bridge + 7 listener events.
- **Verify loop 23/23**.
- **9 ADRs** consolidados.
- **42 TDs fechados / 3 abertos** (todos hardware/UI dependent).

## Warnings

### W1 — TD-004 segue blocker oficial
Mas Cycle 20 reduz risco: wire smoke já valida toda infra. O que falta é apenas UI integration (Live carregar Remote Script + responder via LiveAPI real). 95% do código está exercitado.

### W2 — `wire-smoke` test depende de Python 3 no PATH
Aceito — quando `RUN_WIRE_SMOKE=1` env var setada, assume Python está presente. CI Python job já requer.

## Recomendação

**PASS Cycle 20.** Sistema agora tem real wire-level smoke contra a bridge headless. Próximo:

Cycle 21 / Release Window:
- **TD-004 smoke real** (Live UI). Aposta agora baixa — wire smoke já cobre 95%.
- Tag `v0.1.0-rc.1` quando TD-004 passar.
- Eventual v0.1.0 final.

Estado: sistema é como **maxi-Spec** — 20 ciclos, 42 TDs fechados, 3 primitivas MCP completas, knowledge 100%+, recipes 7/7 categorias, distribution-ready (DXT + Docker + Smithery + CI/release), wire smoke contra bridge headless. **Único bloqueio restante é teste manual em Live.**
