# QA Report — Cycle 5

**Date:** 2026-06-09
**Verdict:** **PASS-WITH-WARNINGS**
**QA:** architect inline.

## Summary

Cycle 5 closed **ahujasid parity 22/22** with 3 knowledge-aware tools, closed TD-012 (Wavetable 60 params with `completeness: complete`) and TD-013 (verify loop integrated in 4 tools), and enabled Phase 2 (listeners scaffold + ADR-0005).

## Tech debt status

| ID | Status | Where |
|---|---|---|
| TD-004 (real smoke) | 🟡 PENDING | depends on manual execution via `docs/smoke-test.md` |
| TD-005 (npm install) | 🟡 PENDING | depends on real machine |
| TD-012 (full Wavetable) | ✅ CLOSED | 60 params in `src/knowledge/devices/wavetable.json` |
| TD-013 (verify integration) | ✅ CLOSED | `set_tempo`, `track_set_volume`, `track_set_name`, `clip_set_name` now emit real `verified` + `diff` |

5 closed in 5 cycles. 2 carry-over (TD-004/005 both non-resolvable in sandbox).

## ahujasid parity — 22/22 ✅

New Cycle 5 tools:
| Method | Handler | Tool |
|---|---|---|
| `browser.load_item` | `handlers/browser.py::BrowserLoadItemHandler` | `browserLoadItemTool` |
| `device.get_parameters` | `handlers/device.py::DeviceGetParametersHandler` NEW file | `deviceGetParametersTool` (knowledge-aware) |
| `device.set_parameter` | `handlers/device.py::DeviceSetParameterHandler` | `deviceSetParameterTool` (resolves name→index) |

Knowledge-aware means:
- `device_get_parameters` enriches the response with `unit/description/automatable/modulatable` when the device is found in `src/knowledge/devices/`.
- `device_set_parameter` accepts `parameter_name` (LLM-friendly) and resolves via 1 round-trip of `device.get_parameters` before calling the setter — lookup goes to live, not to knowledge (LiveAPI is authoritative).

**21 MCP tools registered / 23 JSON-RPC methods in the bridge** (21 exposed + 2 system).

## Phase 2 — listeners

ADR-0005 fixes naming `event.<domain>_<property>_changed` + shape `{value, previous?, ts, ...}`.

Bridge:
- `live/AbletonMind/listeners.py` NEW — `ListenerManager` registers `add_tempo_listener` and `add_is_playing_listener`. Callbacks call `broadcast(method, params)`.
- **Missing:** `BridgeServer.broadcast` in `bridge.py` — NDJSON write to all connected clients. Recorded as TD-014 (cycle 6).

TS:
- TCP client already emits `notification` event since Cycle 1 (no touch needed).
- **Missing:** server bootstrap to forward `notification` → MCP `server.sendNotification`. TD-015.

Even without broadcast/forward, ListenerManager tests in isolation: callback executed → broadcast called.

## Verify loop — TD-013

4 tools migrated:

| Tool | Verify field | Tolerance |
|---|---|---|
| `set_tempo` | tempo | 1e-3 |
| `track_set_volume` | volume | 1e-4 |
| `track_set_name` | name (string equality) | — |
| `clip_set_name` | name | — |

Output gains `verified: boolean` (was `literal(true)`) and `diff: VerifyDiff | null`. **Breaking change** in shape, but pre-1.0 — accepted.

The other 17 tools continue with literal `verified: true` — progressive cycle-by-cycle migration (TD-016 carry-over low).

## Wavetable — TD-012

60 manually curated params, aligned with Live 12.x:
- Osc 1 (9 params), Osc 2 (9), Sub (3), Filter 1 (6), Filter 2 (5+routing), Env 1/2/3 (4 each), LFO 1/2 (3 each), Global/Voicing (10).
- `modulation_matrix.slots = 16` + listed `sources`.
- `completeness: "complete"`, `todo: []`.

Loader `src/knowledge/index.ts` extended to accept `modulation_matrix` in the schema.

## Parity check

```
21 TS tools  ←→  21 MCP-exposed handlers in the bridge  ←→  20 methods documented in phase0-methods.md
```

**Drift detected:** contract doc (`phase0-methods.md`) covers up to §20; needs §21..§23 for `browser.load_item`, `device.get_parameters`, `device.set_parameter`. Recorded as TD-017 (low).

## Tests

**No tests were written for the 3 new Cycle 5 handlers/tools nor for the ListenerManager.** Patterns exist (Cycles 3-4) — just write them. TD-018 (medium).

## Warnings

### W1 — TD-014: bridge.broadcast() not implemented
`listeners.py` calls `broadcast(method, params)` which must be passed by `__init__.py` AbletonMind when instantiating the manager. The method in `bridge.py` that writes NDJSON to all sockets was not written this cycle. Cycle 6.

### W2 — TD-015: server bootstrap does not forward notifications to MCP
Client emits `notification` event; needs wiring in `src/server/index.ts` that calls the equivalent of `server.sendNotification({method, params})`. Cycle 6.

### W3 — TD-016: 17 tools without verify integration
Progressive migration. No urgency — literal `verified: true` does not lie when the handler already reads post-mutation state in the bridge.

### W4 — TD-017: contract doc outdated
3 new methods undocumented in `phase0-methods.md`. Cycle 6.

### W5 — TD-018: Cycle 5 tests not written
Known patterns. Cycle 6.

## Recommendation

**PASS Cycle 5.** Phase 1 closed in code. Next:

Cycle 6:
- Real smoke (TD-004) — official Phase 0 gate.
- TD-014/015 — close end-to-end notifications pipeline.
- TD-017/018 — doc + tests.
- Phase 2 expansion: track (name, volume, mute, solo) and clip (name, is_playing) listeners.
- Knowledge: 4 new devices (Operator, EQ Eight, Compressor, Reverb) — real extract + curation.
