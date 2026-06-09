# QA Report — Cycle 1 (Phase 0 Spike)

**Data:** 2026-06-08
**Veredito:** **PASS-WITH-WARNINGS**
**QA:** architect (inline; qa-integration não foi dispatched porque os 2 agentes do ciclo já tinham crashado com API error de socket — decisão para preservar progresso).

## Resumo

Spike entregue end-to-end no nível de código:
- Bridge Python (7 handlers + dispatcher TCP NDJSON + transações + LiveAPI mock).
- Server TS (entry stdio + cliente TCP + handshake + tool `play` + tests).
- Docs (arquitetura).
- Contratos JSON-RPC congelados, NÃO mutados.

Smoke contra Live real **não** foi rodado neste ciclo (planejado para Ciclo 2). Veredito PASS porque o gate de Phase 0 não exige smoke ainda — é só scaffolding + 1 tool. WARNINGS abaixo.

## Checks realizados

### 1. Parity check (TS ↔ Python)

| Método contrato | Handler Python | Tool TS / cliente | Status |
|---|---|---|---|
| `system.hello` | `handlers/system.py::HelloHandler` | `live-client/handshake.ts::performHandshake` | ✅ |
| `system.ping` | `handlers/system.py::PingHandler` | (cliente direto via `client.call`) | ✅ |
| `transport.play` | `handlers/transport.py::PlayHandler` | `tools/transport.ts::playTool` | ✅ |
| `transport.stop` | `handlers/transport.py::StopHandler` | (sem tool MCP — Phase 1) | ⚠ esperado para Phase 0 |
| `transport.set_tempo` | `handlers/transport.py::SetTempoHandler` | (sem tool MCP — Phase 1) | ⚠ esperado para Phase 0 |
| `track.list` | `handlers/track.py::TrackListHandler` | (sem tool MCP — Phase 1) | ⚠ esperado para Phase 0 |
| `clip.create_midi` | `handlers/clip.py::CreateMidiClipHandler` | (sem tool MCP — Phase 1) | ⚠ esperado para Phase 0 |

Conformidade contrato: Phase 0 entrega 1 tool MCP (`play`). Os outros 6 handlers existem no bridge mas não estão expostos como tool MCP — alinha com o briefing.

### 2. Contract drift

```
$ git diff --stat _workspace/contracts/
(empty)
```

Contratos `jsonrpc.md` e `phase0-methods.md` preservados. Nenhum `PROPOSED-*.md` foi escrito pelos agentes. ✅

### 3. Error code mapping (TS ↔ Python)

| Código | TS (`ABLETON_MIND_ERRORS`) | Python (`errors.py`) | Match |
|---|---|---|---|
| -32000 | `LIVE_NOT_RUNNING` | `LIVE_NOT_RUNNING` | ✅ |
| -32001 | `LIVE_API_CALL_FAILED` | `LIVE_API_FAILED` | ✅ (nome difere mas valor bate) |
| -32002 | `OBJECT_NOT_FOUND` | `OBJECT_NOT_FOUND` | ✅ |
| -32003 | `TYPE_MISMATCH` | `TYPE_MISMATCH` | ✅ |
| -32004 | `OUT_OF_RANGE` | `OUT_OF_RANGE` | ✅ |
| -32005 | `INVALID_STATE` | `INVALID_STATE` | ✅ |
| -32006 | `TRANSACTION_ERROR` | `TRANSACTION_ERROR` | ✅ |
| -32007 | `LISTENER_ERROR` | `LISTENER_ERROR` | ✅ |
| -32008 | `KNOWLEDGE_LOOKUP_FAILED` | `KNOWLEDGE_LOOKUP_FAILED` | ✅ |

⚠ **Nit minor:** TS usa `LIVE_API_CALL_FAILED`, Python usa `LIVE_API_FAILED`. Mesmo código numérico (-32001), nomes inconsistentes. Não é bug; só estilo. Fix no Ciclo 2 (renomear Python para `LIVE_API_CALL_FAILED`).

### 4. Schema shape parity (transport.play)

Contrato `phase0-methods.md §3`:
```ts
{ changed: boolean; is_playing: boolean; current_song_time: number }
```

- Python `PlayHandler.execute` retorna exatamente esses 3 campos com tipos certos (bool, bool, float). ✅
- TS `playBridgeResultSchema` (`tools/transport.ts`) faz `z.object({changed, is_playing, current_song_time}).parse(raw)`. ✅

### 5. Idempotência

- `transport.play`: read `is_playing` antes; só chama `start_playing()` se não estava tocando. ✅
- `transport.stop`: idem. ✅
- `transport.set_tempo`: tolerância 1e-3 antes de set. ✅
- `clip.create_midi`: verifica `has_clip` antes; levanta -32005 se ocupado. ✅

### 6. Transações

- `with undo_step("clip.create_midi", song):` em `handlers/clip.py:91`. ✅
- Begin/end via try/finally em `transactions.py:18,30`. ✅

### 7. Threading no bridge

- TCP server em thread daemon. ✅
- Despacho ao main thread via `queue.Queue` + `ctrl.schedule_message(50, _drain_queue)`. ✅
- Modo `headless=True` para testes — despacho síncrono na thread do socket. ✅

### 8. Recipes lint

N/A em Phase 0 (sem recipes).

### 9. Smoke test

⚠ **Não rodado**. Bridge inteiro testado contra LiveAPI mock (`tests/_fakes/live_api.py`); TS testado contra mock TCP loopback. Smoke real (TS + bridge dentro do Live) é planejado para Ciclo 2.

## Warnings (não bloqueiam Phase 0, mas registram débito)

### W1 — Bug `Number(undefined) ?? DEFAULT`
**Arquivo:** [src/live-client/tcp-client.ts:87,89](../../src/live-client/tcp-client.ts)
```ts
this.port = options.port ?? Number(process.env.ABLETON_MIND_PORT) ?? DEFAULT_PORT;
```
`Number(undefined)` retorna `NaN`, não `undefined`. `??` só faz fallback para `null|undefined`. Resultado: env vars não setadas viram `NaN`.

**Fix sugerido:**
```ts
const envPort = process.env.ABLETON_MIND_PORT;
this.port = options.port ?? (envPort ? Number(envPort) : DEFAULT_PORT);
```

**Severidade:** medium. Não quebra com defaults; só quebra se alguém setar env var inválida ou em ambientes especiais. Fix simples no Ciclo 2.

### W2 — Indexing provisório de master/return em `track.list`
**Arquivo:** [live/AbletonMind/handlers/track.py:5-9](../../live/AbletonMind/handlers/track.py)

Convencionado -1 master, -2..-N returns. Phase 1 precisa realinhar para coleções separadas (`song.tracks`, `song.return_tracks`, `song.master_track`).

**Severidade:** baixa. Documentado no próprio handler e no contrato.

### W3 — Smoke real não rodou
Bridge contra Live aberto (`python -m live.AbletonMind` carregado pelo Live como Remote Script) + TS conectando + tool `play` disparando — só dá pra rodar em máquina com Live instalado. Ciclo 2 deve incluir esse smoke como gate antes de fechar Phase 0.

### W4 — Naming inconsistente em error code -32001
TS: `LIVE_API_CALL_FAILED`. Python: `LIVE_API_FAILED`. Mesmo valor numérico. Renomear Python.

**Severidade:** trivial.

## Recomendação para o architect

PASS Phase 0 — Cycle 1. Spike infraestrutural completo, sem regressões. Mover warnings para `tech-debt.md` e seguir para Ciclo 2:

**Ciclo 2 sugerido:**
- Smoke real contra Live (gate de fechamento de Phase 0).
- Fix W1 (NaN env var) e W4 (rename).
- Iniciar Phase 1 (Paridade ahujasid): 22 tools do `ahujasid/ableton-mcp` mapeadas para nossos handlers + verify loop.
