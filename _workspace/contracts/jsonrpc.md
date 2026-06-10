# Contract — JSON-RPC 2.0 over TCP

**Version:** 0.1 (Phase 0 Spike)
**Owners:** ts-server-engineer (client), python-bridge-engineer (server)
**Status:** Frozen for Phase 0. Mutations → ADR.

## Transport

- **Protocol:** local TCP socket.
- **Default host:** `127.0.0.1`
- **Default port:** `9876`
- **Override:** env vars `ABLETON_MIND_HOST`, `ABLETON_MIND_PORT`.
- **Framing:** Newline-delimited JSON (`\n` separates messages). Each message is ONE JSON line, no pretty-print.
- **Encoding:** UTF-8.
- **Connection:** the server (bridge) accepts multiple clients but Phase 0 assumes 1 client. Transparent reconnect on the TS side.

### Why NDJSON and not Content-Length

NDJSON is simple for the Spike. Phase 1 evaluates switching to `Content-Length` (LSP style) if there are messages >1MB (knowledge dumps).

## JSON-RPC 2.0 envelope

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

### Notification (server → client, without `id`)
```json
{ "jsonrpc": "2.0", "method": "event.beat", "params": {...} }
```

## Method naming

`{domain}.{verb}` — always lowercase, dot-separated.

- Phase 0 domains: `transport`, `track`, `clip`, `ping`.
- Common verbs: `get`, `set`, `list`, `create`, `delete`, `play`, `stop`, `add`.
- Notifications: `event.{name}` (e.g. `event.beat`, `event.track_added`).

## Error codes

JSON-RPC reserved (do not use):
- `-32700` Parse error
- `-32600` Invalid Request
- `-32601` Method not found
- `-32602` Invalid params
- `-32603` Internal error

Custom (ableton-mind, range -32000 to -32099):
- `-32000` Live not running / API unavailable
- `-32001` Live API call failed (raw exception)
- `-32002` Object not found (track, clip, scene, device)
- `-32003` Type mismatch (e.g. attempted MIDI op on audio track)
- `-32004` Out of range (index, value beyond min/max)
- `-32005` Invalid state (e.g. attempted record without arm)
- `-32006` Transaction error (broken undo step)
- `-32007` Listener error
- `-32008` Knowledge lookup failed

`error.data` ALWAYS carries actionable context:
- `{ "num_tracks": 3 }` when `-32002` on `track.get index=5`
- `{ "min": 0, "max": 127, "got": 200 }` when `-32004`
- `{ "expected": "midi", "actual": "audio" }` when `-32003`

## Idempotency

Every mutation MUST:
1. Read the current state first.
2. If already in the requested state → return `result: { changed: false, ... }`.
3. Otherwise apply and return `result: { changed: true, before: {...}, after: {...} }`.

Phase 0 establishes the pattern; Phase 1 audits compliance.

## Transactions (undo)

Composite ops wrap `Song.begin_undo_step()` / `end_undo_step()` in the bridge. Phase 0 does NOT expose this to the client — the handler decides. Phase 4 exposes `tx.begin` / `tx.commit` for the LLM to group.

## Notifications (Phase 0 = stub)

The Spike only implements optional `event.beat` (not required). Full listeners arrive in Phase 2.

## Version and handshake

First client message: `system.hello`
```json
{ "jsonrpc": "2.0", "id": 1, "method": "system.hello", 
  "params": { "client": "ableton-mind/ts", "version": "0.0.1" } }
```

Bridge response:
```json
{ "jsonrpc": "2.0", "id": 1, "result": {
  "bridge": "ableton-mind/python", "version": "0.0.1",
  "live_version": "12.0.10", "python_version": "3.11.6",
  "protocol_version": "0.1" } }
```

Phase 0: protocol 0.1. Breaking change → major bump.
