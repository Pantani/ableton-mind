# Contrato — JSON-RPC 2.0 sobre TCP

**Versão:** 0.1 (Phase 0 Spike)
**Owners:** ts-server-engineer (cliente), python-bridge-engineer (servidor)
**Status:** Frozen para Phase 0. Mutações → ADR.

## Transport

- **Protocolo:** TCP socket local.
- **Host default:** `127.0.0.1`
- **Porta default:** `9876`
- **Override:** env vars `ABLETON_MIND_HOST`, `ABLETON_MIND_PORT`.
- **Framing:** Newline-delimited JSON (`\n` separa mensagens). Cada mensagem é UMA linha JSON, sem pretty-print.
- **Encoding:** UTF-8.
- **Conexão:** server (bridge) aceita múltiplos clientes mas Phase 0 assume 1 cliente. Reconnect transparente do lado TS.

### Por que NDJSON e não Content-Length

NDJSON é simples para Spike. Phase 1 avalia trocar por `Content-Length` (estilo LSP) se houver mensagens >1MB (knowledge dumps).

## Envelope JSON-RPC 2.0

### Request
```json
{ "jsonrpc": "2.0", "id": 42, "method": "track.set", "params": {...} }
```

### Response (success)
```json
{ "jsonrpc": "2.0", "id": 42, "result": {...} }
```

### Response (error)
```json
{ "jsonrpc": "2.0", "id": 42, "error": { "code": -32000, "message": "...", "data": {...} } }
```

### Notification (server → client, sem `id`)
```json
{ "jsonrpc": "2.0", "method": "event.beat", "params": {...} }
```

## Método naming

`{domain}.{verb}` — sempre lowercase, ponto-separado.

- Domínios Phase 0: `transport`, `track`, `clip`, `ping`.
- Verbos comuns: `get`, `set`, `list`, `create`, `delete`, `play`, `stop`, `add`.
- Notifications: `event.{name}` (ex: `event.beat`, `event.track_added`).

## Códigos de erro

Reservados JSON-RPC (não usar):
- `-32700` Parse error
- `-32600` Invalid Request
- `-32601` Method not found
- `-32602` Invalid params
- `-32603` Internal error

Custom (ableton-mind, faixa -32000 a -32099):
- `-32000` Live not running / API unavailable
- `-32001` Live API call failed (raw exception)
- `-32002` Object not found (track, clip, scene, device)
- `-32003` Type mismatch (e.g. tentou MIDI op em audio track)
- `-32004` Out of range (index, valor além de min/max)
- `-32005` Invalid state (e.g. tentou record sem arm)
- `-32006` Transaction error (undo step quebrado)
- `-32007` Listener error
- `-32008` Knowledge lookup failed

`error.data` SEMPRE traz contexto acionável:
- `{ "num_tracks": 3 }` quando `-32002` em `track.get index=5`
- `{ "min": 0, "max": 127, "got": 200 }` quando `-32004`
- `{ "expected": "midi", "actual": "audio" }` quando `-32003`

## Idempotência

Toda mutação MUST:
1. Ler estado atual primeiro.
2. Se já está no estado pedido → retorna `result: { changed: false, ... }`.
3. Caso contrário aplica e retorna `result: { changed: true, before: {...}, after: {...} }`.

Phase 0 lança o padrão; Phase 1 audita compliance.

## Transações (undo)

Composite ops envolvem `Song.begin_undo_step()` / `end_undo_step()` no bridge. Phase 0 NÃO expõe isso ao cliente — handler decide. Phase 4 expõe `tx.begin` / `tx.commit` para LLM agrupar.

## Notifications (Phase 0 = stub)

Spike só implementa `event.beat` opcional (não obrigatório). Listeners completos chegam Phase 2.

## Versão e handshake

Primeira mensagem do cliente: `system.hello`
```json
{ "jsonrpc": "2.0", "id": 1, "method": "system.hello", 
  "params": { "client": "ableton-mind/ts", "version": "0.0.1" } }
```

Resposta do bridge:
```json
{ "jsonrpc": "2.0", "id": 1, "result": {
  "bridge": "ableton-mind/python", "version": "0.0.1",
  "live_version": "12.0.10", "python_version": "3.11.6",
  "protocol_version": "0.1" } }
```

Phase 0: protocolo 0.1. Mudança breaking → bump major.
