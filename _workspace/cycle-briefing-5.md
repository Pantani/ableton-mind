# Cycle 5 — 2026-06-09

**PLAN.md Phase:** close Phase 1 (ahujasid parity 22/22) + Phase 2 begins (listeners → MCP notifications).
**Goal:** 3 knowledge-aware tools (`load_browser_item`, `get_device_parameters`, `set_device_parameter`); verify loop integrated in 4 tools (TD-013); Wavetable expanded (TD-012); listeners scaffold with 2 listeners and ADR-0005.

## Strategy

Inline. Patterns 100% mature. Auto mode.

## Assignments

### Track A — Python Bridge
1. 3 handlers: `browser.load_item`, `device.get_parameters`, `device.set_parameter`.
2. `listeners.py` — registers LiveAPI listeners (tempo, is_playing) and pushes notifications via `bridge.broadcast(method, params)`.
3. `bridge.py` gets a `broadcast(method, params)` method that serializes a JSON-RPC notification and writes to all connected sockets.
4. Corresponding schemas.
5. Tests for the 3 handlers + listener smoke (manual trigger).

### Track A — TS Server
1. 3 tools mapping the handlers.
2. `src/tools/device.ts` new (get/set device parameter — uses `loadDevice()` from the knowledge to resolve name → index).
3. `src/tools/browser.ts` gets `browser_load_item`.
4. Integrate `verifyField()` in 4 tools (TD-013).
5. TCP client already emits the `notification` event (Cycle 1) — only formalize bridge → MCP notification in `src/server/index.ts`.

### Track B — Knowledge
1. TD-012: complete Wavetable.json (~50 params manually curated, aligned with Live 12).
2. Validate via `loadDevice("wavetable")` (Zod parse passes).

### Track — Docs / ADR
1. ADR-0005 — notifications format and event names.

## New contracts

- `browser.load_item` — `{ path: string[] }` → `{ loaded: bool, name: string }`. Loads the browser item on the armed track (LiveAPI: `application().browser.load_item(item)`).
- `device.get_parameters` — `{ track_index: number; device_index: number }` → `{ device_name, parameters: [...] }`. Knowledge-aware: enriches with canonical names when available.
- `device.set_parameter` — `{ track_index, device_index, name?: string, index?: number, value: number }` → idempotent. `name` resolved via knowledge before calling the bridge.
- `event.transport_tempo_changed` — `{ tempo: number }`.
- `event.transport_is_playing_changed` — `{ is_playing: boolean }`.

## Gate criteria

- [ ] ahujasid parity 22/22.
- [ ] TD-012, TD-013 closed.
- [ ] ADR-0005 written.
- [ ] 2 listeners active in the bridge.
- [ ] PROGRESS.md updated.

## Next

Cycle 6: real smoke (TD-004) + Phase 3 (more devices: Operator, EQ Eight, Compressor, Reverb) + Phase 2 listener expansion (track.* + clip.*).
