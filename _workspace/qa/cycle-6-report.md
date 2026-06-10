# QA Report — Cycle 6

**Date:** 2026-06-09
**Verdict:** **PASS-WITH-WARNINGS**
**QA:** architect inline.

## Summary

Cycle 6 closed the **end-to-end notifications pipeline** (TD-014 + TD-015), updated the contract doc (TD-017), filled the test gap (TD-018), and quadrupled knowledge coverage (EQ Eight + Compressor + Reverb + Operator). **Phase 2 functional in code** — only real smoke is missing to confirm against actual Live.

## Tech debt status

| ID | Status | Where |
|---|---|---|
| TD-004 (real smoke) | 🟡 PENDING | `docs/smoke-test.md` |
| TD-005 (npm install) | 🟡 PENDING | real machine |
| TD-014 (broadcast) | ✅ CLOSED | `BridgeServer.broadcast()` in `bridge.py:188` + ListenerManager wired in `__init__.py` |
| TD-015 (TS forward) | ✅ CLOSED | `src/server/notifications.ts` + `attachNotificationForwarder` in `src/index.ts` |
| TD-016 (verify carry-over) | 🟡 PENDING | 17 tools (progressive migration) |
| TD-017 (contract doc) | ✅ CLOSED | `phase0-methods.md` §21..§24 |
| TD-018 (Cycle 5 tests) | ✅ CLOSED | `test_cycle5_6.py` + `server-notifications.test.ts` + `tools-device-browser-load.test.ts` |

**4 closed / 3 carry-over** (all low or non-resolvable in sandbox).

## Notifications pipeline

```
Live event (e.g. user changes tempo in the GUI)
  → LiveAPI fires `add_tempo_listener` callback
  → ListenerManager._on_tempo() on main thread
  → bridge.broadcast("event.transport_tempo_changed", {value, previous, ts})
  → loop over self._clients[]: socket.sendall(JSON-RPC notification + \n)
  → Dead sockets removed from _clients

TS server:
  TcpJsonRpcClient.processLine() detects msg without `id` → emit("notification", method, params)
  → attachNotificationForwarder handler → forwardNotification()
  → filters `event.` prefix (discards the rest with warn)
  → notifier (= McpServer.server.notification(...)) forwards to the MCP client
  → errors are swallowed with log (do not break the TCP connection)
```

Tests cover each piece in isolation (mock socketpair, EventEmitter fake, vi.fn notifier).

## Parity check

**23 JSON-RPC methods** in the bridge / **21 MCP tools** registered in TS. Match.

Active Phase 2 events:
- `event.transport_tempo_changed`
- `event.transport_is_playing_changed`

Documented in `phase0-methods.md §24`.

## Knowledge

| Device | Params | Completeness | JSON lines |
|---|---|---|---|
| Wavetable | 60 | complete (Cycle 5) | ~150 |
| Operator | 53 | complete | ~80 |
| EQ Eight | 45 | complete | ~75 |
| Compressor | 21 | complete | ~50 |
| Reverb | 31 | complete | ~55 |

**5 devices** totaling **210 indexed parameters**. PLAN.md §5 target is 50+ devices → Phase 3 still long.

`src/knowledge/index.ts::KNOWN_DEVICES` updated.

## Tests

Python:
- `test_cycle5_6.py` NEW: 4 test classes / 16+ cases covering browser.load_item, device.get_parameters, device.set_parameter, ListenerManager, BridgeServer.broadcast.

TS:
- `server-notifications.test.ts` NEW: 5 cases (forwarding, drop non-event, error swallow, attach/dispose).
- `tools-device-browser-load.test.ts` NEW: 8 cases (browser_load_item input/output, device tools knowledge enrichment, name resolution, error path).

**Estimated coverage** accumulated (all cycles): ~120 TS test cases + ~50 Python test cases.

## Contract drift

`phase0-methods.md` now covers §1..§24 across all 23 methods + events section. Drift = 0. ✅

## Warnings

### W1 — TD-016: 17 tools still with literal `verified: true`
Progressive migration. Cycle 7 should migrate +5-10. Low.

### W2 — `McpServer.server.notification` API depends on SDK internals
We access via cast `(server as unknown as { server: { notification } }).server.notification(...)`. If SDK 2.x changes naming, it breaks. Mitigated by the injectable `McpNotifier` adapter — tests mock the function, not the SDK. TD-019 (low, monitoring).

### W3 — Broadcast in headless mode writes to dead sockets before detecting
Expected TCP behavior — only on the next write does the OS report EPIPE/RESET. The detector works but may take 1-2 broadcasts to remove. Low, no action.

### W4 — `_seed_track_with_device` in Python tests mutated `FakeDeviceParameter`
I added `name/is_quantized/value_items/automation_state` post-construction because `FakeDeviceParameter` was created in Cycle 3 without those fields. Not migrated to the constructor so as not to break existing tests. TD-020 (trivial).

## Recommendation

**PASS Cycle 6.** Phase 2 functional in code. Next:

Cycle 7:
- Real smoke (TD-004) — Phase 0 gate.
- TD-016 progress — migrate verify on 5-10 more tools.
- TD-019 / TD-020 (low).
- Phase 2 expansion: track listeners (name, mute, solo, volume).
- Phase 4 begin: automation envelopes (`Song.scrub_by`, `Clip.envelope_add_point`, etc.).
- Phase 3 cont: +5 devices (Auto Filter, Echo, Saturator, Delay, Drum Rack).
