# ADR 0005 — Listener notifications format

**Date:** 2026-06-09
**Status:** Accepted
**Author:** architect

## Context

PLAN.md §4.21 promises reactive listeners: state changes in Live become MCP notifications for the LLM client. AbletonOSC delivers via raw OSC; we deliver via JSON-RPC notification (already specified in the contract in `_workspace/contracts/jsonrpc.md`).

Still to define:
1. Method names for the events.
2. `params` shape.
3. Which events to enable first.
4. How the MCP server forwards to the LLM.

## Decision

### 1. Naming

`event.<domain>_<property>_changed`. e.g.:
- `event.transport_tempo_changed`
- `event.transport_is_playing_changed`
- `event.transport_current_song_time_changed` (high frequency — opt-in via subscribe)
- `event.track_<i>_name_changed`
- `event.track_<i>_volume_changed`
- `event.clip_<t>_<s>_name_changed`

Why NOT `event.<domain>.<verb>`: the dot is already the JSON-RPC method separator on the request side; mixing creates parsing confusion. Underscore is more readable.

Beat events stay outside the standard (`event.beat`) because they were already in the JSON-RPC contract §framing.

### 2. Shape

```ts
{
  jsonrpc: "2.0",
  method: "event.<name>",
  params: {
    // ALWAYS includes the new value:
    value: T,
    // OPTIONAL, present in API mutations (not in playback):
    previous?: T,
    // ALWAYS includes timestamp (ms epoch — server bridge wall clock):
    ts: number,
    // For object-scoped listeners: reference to the object.
    track_index?: number,
    clip_slot_index?: number,
    return_track_index?: number,
  }
}
```

### 3. Bootstrap (Cycle 5)

Enables only:
- `event.transport_tempo_changed`
- `event.transport_is_playing_changed`

Phase 2 expands to track/clip listeners. Phase 3 adds probability/beat listeners.

### 4. Forwarding server → MCP client

`src/server/index.ts` listens to `client.on("notification", ...)` and:

- If the method begins with `event.`, forwards via `server.notification({method, params})` (MCP SDK 1.x).
- Otherwise, logs a warn and ignores (drift protection).

The MCP client receives it as `notifications/<method>` (standard MCP format).

### 5. Subscribe / unsubscribe

Phase 2 does NOT require subscribe — all events go to the client. Phase 3 introduces `subscribe(events: string[])` to reduce traffic on high-frequency events (current_song_time, beat).

## Consequences

- The bridge needs `BridgeServer.broadcast(method, params)` which serializes NDJSON on all connected sockets (Phase 0 did not need this because everything was synchronous request/response).
- Threading: LiveAPI callbacks execute on the main thread (Live API constraint). `broadcast()` enqueues on the socket IO thread, identical to what the request dispatcher already does in reverse.
- Idempotency does not apply to events (but we guarantee at-most-once for mutation via unitary undo).

## How to apply

- `live/AbletonMind/listeners.py` (new): registers `song.add_tempo_listener(callback)` and `song.add_is_playing_listener(callback)`. Callbacks call `bridge.broadcast`.
- `live/AbletonMind/bridge.py`: `broadcast(method, params)` method that iterates `self._clients` and writes NDJSON.
- `src/server/index.ts`: notification handler that detects `event.` prefix and forwards to the MCP server via `server.sendNotification` (or equivalent).

If the MCP SDK's API does not expose sendNotification easily in 1.x, encapsulate in `src/server/notifications.ts` and mock until version 2.x.
