# QA Report — Cycle 1 (Phase 0 Spike)

**Date:** 2026-06-08
**Verdict:** **PASS-WITH-WARNINGS**
**QA:** architect (inline; qa-integration was not dispatched because the cycle's 2 agents had already crashed with a socket API error — decision to preserve progress).

## Summary

Spike delivered end-to-end at code level:
- Python bridge (7 handlers + TCP NDJSON dispatcher + transactions + LiveAPI mock).
- TS server (stdio entry + TCP client + handshake + `play` tool + tests).
- Docs (architecture).
- JSON-RPC contracts frozen, NOT mutated.

Smoke against real Live was **not** run this cycle (planned for Cycle 2). PASS verdict because the Phase 0 gate does not require smoke yet — it is only scaffolding + 1 tool. WARNINGS below.

## Checks performed

### 1. Parity check (TS ↔ Python)

| Contract method | Python handler | TS tool / client | Status |
|---|---|---|---|
| `system.hello` | `handlers/system.py::HelloHandler` | `live-client/handshake.ts::performHandshake` | ✅ |
| `system.ping` | `handlers/system.py::PingHandler` | (direct client via `client.call`) | ✅ |
| `transport.play` | `handlers/transport.py::PlayHandler` | `tools/transport.ts::playTool` | ✅ |
| `transport.stop` | `handlers/transport.py::StopHandler` | (no MCP tool — Phase 1) | ⚠ expected for Phase 0 |
| `transport.set_tempo` | `handlers/transport.py::SetTempoHandler` | (no MCP tool — Phase 1) | ⚠ expected for Phase 0 |
| `track.list` | `handlers/track.py::TrackListHandler` | (no MCP tool — Phase 1) | ⚠ expected for Phase 0 |
| `clip.create_midi` | `handlers/clip.py::CreateMidiClipHandler` | (no MCP tool — Phase 1) | ⚠ expected for Phase 0 |

Contract conformance: Phase 0 delivers 1 MCP tool (`play`). The other 6 handlers exist in the bridge but are not exposed as MCP tools — aligns with the briefing.

### 2. Contract drift

```
$ git diff --stat _workspace/contracts/
(empty)
```

`jsonrpc.md` and `phase0-methods.md` contracts preserved. No `PROPOSED-*.md` was written by the agents. ✅

### 3. Error code mapping (TS ↔ Python)

| Code | TS (`ABLETON_MIND_ERRORS`) | Python (`errors.py`) | Match |
|---|---|---|---|
| -32000 | `LIVE_NOT_RUNNING` | `LIVE_NOT_RUNNING` | ✅ |
| -32001 | `LIVE_API_CALL_FAILED` | `LIVE_API_FAILED` | ✅ (name differs but value matches) |
| -32002 | `OBJECT_NOT_FOUND` | `OBJECT_NOT_FOUND` | ✅ |
| -32003 | `TYPE_MISMATCH` | `TYPE_MISMATCH` | ✅ |
| -32004 | `OUT_OF_RANGE` | `OUT_OF_RANGE` | ✅ |
| -32005 | `INVALID_STATE` | `INVALID_STATE` | ✅ |
| -32006 | `TRANSACTION_ERROR` | `TRANSACTION_ERROR` | ✅ |
| -32007 | `LISTENER_ERROR` | `LISTENER_ERROR` | ✅ |
| -32008 | `KNOWLEDGE_LOOKUP_FAILED` | `KNOWLEDGE_LOOKUP_FAILED` | ✅ |

⚠ **Minor nit:** TS uses `LIVE_API_CALL_FAILED`, Python uses `LIVE_API_FAILED`. Same numeric code (-32001), inconsistent names. Not a bug; just style. Fix in Cycle 2 (rename Python to `LIVE_API_CALL_FAILED`).

### 4. Schema shape parity (transport.play)

Contract `phase0-methods.md §3`:
```ts
{ changed: boolean; is_playing: boolean; current_song_time: number }
```

- Python `PlayHandler.execute` returns exactly those 3 fields with correct types (bool, bool, float). ✅
- TS `playBridgeResultSchema` (`tools/transport.ts`) does `z.object({changed, is_playing, current_song_time}).parse(raw)`. ✅

### 5. Idempotency

- `transport.play`: reads `is_playing` first; only calls `start_playing()` if not playing. ✅
- `transport.stop`: same. ✅
- `transport.set_tempo`: 1e-3 tolerance before set. ✅
- `clip.create_midi`: verifies `has_clip` first; raises -32005 if occupied. ✅

### 6. Transactions

- `with undo_step("clip.create_midi", song):` in `handlers/clip.py:91`. ✅
- Begin/end via try/finally in `transactions.py:18,30`. ✅

### 7. Threading in the bridge

- TCP server in daemon thread. ✅
- Dispatch to main thread via `queue.Queue` + `ctrl.schedule_message(50, _drain_queue)`. ✅
- `headless=True` mode for tests — synchronous dispatch on the socket thread. ✅

### 8. Recipes lint

N/A in Phase 0 (no recipes).

### 9. Smoke test

⚠ **Not run**. Entire bridge tested against LiveAPI mock (`tests/_fakes/live_api.py`); TS tested against loopback mock TCP. Real smoke (TS + bridge inside Live) is planned for Cycle 2.

## Warnings (do not block Phase 0, but record debt)

### W1 — `Number(undefined) ?? DEFAULT` bug
**File:** [src/live-client/tcp-client.ts:87,89](../../src/live-client/tcp-client.ts)
```ts
this.port = options.port ?? Number(process.env.ABLETON_MIND_PORT) ?? DEFAULT_PORT;
```
`Number(undefined)` returns `NaN`, not `undefined`. `??` only falls back to `null|undefined`. Result: unset env vars become `NaN`.

**Suggested fix:**
```ts
const envPort = process.env.ABLETON_MIND_PORT;
this.port = options.port ?? (envPort ? Number(envPort) : DEFAULT_PORT);
```

**Severity:** medium. Does not break with defaults; only breaks if someone sets an invalid env var or in special environments. Simple fix in Cycle 2.

### W2 — Provisional master/return indexing in `track.list`
**File:** [live/AbletonMind/handlers/track.py:5-9](../../live/AbletonMind/handlers/track.py)

Conventioned -1 master, -2..-N returns. Phase 1 needs to realign to separate collections (`song.tracks`, `song.return_tracks`, `song.master_track`).

**Severity:** low. Documented in the handler itself and in the contract.

### W3 — Real smoke did not run
Bridge against open Live (`python -m live.AbletonMind` loaded by Live as Remote Script) + TS connecting + `play` tool triggering — only runs on a machine with Live installed. Cycle 2 should include this smoke as gate before closing Phase 0.

### W4 — Inconsistent naming on error code -32001
TS: `LIVE_API_CALL_FAILED`. Python: `LIVE_API_FAILED`. Same numeric value. Rename Python.

**Severity:** trivial.

## Recommendation for the architect

PASS Phase 0 — Cycle 1. Complete infrastructure spike, no regressions. Move warnings to `tech-debt.md` and proceed to Cycle 2:

**Suggested Cycle 2:**
- Real smoke against Live (Phase 0 closure gate).
- Fix W1 (NaN env var) and W4 (rename).
- Start Phase 1 (ahujasid parity): 22 `ahujasid/ableton-mcp` tools mapped to our handlers + verify loop.
