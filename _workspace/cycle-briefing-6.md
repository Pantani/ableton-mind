# Cycle 6 — 2026-06-09

**PLAN.md Phase:** Phase 2 — listeners → MCP notifications (close end-to-end pipeline). Phase 3 — knowledge expansion (+4 devices).

**Goal:** finish the notifications track (TD-014 + TD-015), update contract doc (TD-017), fill test coverage (TD-018), curate EQ Eight / Compressor / Reverb / Operator.

## Strategy

Inline. Patterns 100% mature.

## Assignments

### Track A — Bridge
1. `bridge.py::BridgeServer.broadcast(method, params)` — writes NDJSON to all connected sockets. Thread-safe (lock on `_clients`).
2. `__init__.py::AbletonMind` — instantiates `ListenerManager` in `setup()` and calls `teardown()` in `disconnect()`.
3. Tests for `broadcast()` and the ListenerManager wiring (`tests/test_listeners.py`).

### Track A — TS Server
1. `src/server/notifications.ts` — wrapper that receives `(method, params)` and calls `mcpServer.sendNotification`. Fail-soft if the method does not begin with `event.`.
2. `src/index.ts` — `client.on("notification", forwarder)`.
3. Tests (`tests/server-notifications.test.ts`) with a mock McpServer.

### Track B — Knowledge
1. `src/knowledge/devices/eq_eight.json` — 8 bands (each Freq/Gain/Q/On/Type) + Output Gain + Scale + Mode + 4 view params.
2. `src/knowledge/devices/compressor.json` — Threshold/Ratio/Attack/Release/Knee/Gain/Lookahead/Sidechain.
3. `src/knowledge/devices/reverb.json` — Room/Decay/Damping/Predelay/EarlyRefs/Diffusion/HighShelf/Wet/Stereo.
4. `src/knowledge/devices/operator.json` — 4 osc (Coarse/Fine/Level/Envelope/Wave) + Filter + Global + Algorithm.
5. Update `KNOWN_DEVICES` in `src/knowledge/index.ts`.

### Track — Architect
1. TD-017: §21..§23 (browser.load_item, device.get_parameters, device.set_parameter) + §24 (events).

## Contracts

`browser.load_item`, `device.get_parameters`, `device.set_parameter` — already implemented in Cycle 5, now documented.
`event.transport_*` — already in ADR-0005; I document the shape in §24 of the contract.

## Gate criteria

- [ ] TD-014/015 closed.
- [ ] TD-017 closed (§21..§24).
- [ ] TD-018 closed (tests covering Cycle 5 + listeners + notification forwarder).
- [ ] 4 device JSONs added + index updated.
- [ ] PROGRESS.md reflecting Phase 2 end-to-end functional (in code).

## Next

Cycle 7: real smoke (TD-004), continue verify integration (TD-016), Phase 4 (automation envelopes) begins.
