# QA Report — Cycle 2 (tech debt + Phase 1 start)

**Date:** 2026-06-08
**Verdict:** **PASS-WITH-WARNINGS**
**QA:** architect inline (same justification as Cycle 1; returns to qa-integration dispatch when work is large).

## Summary

Cycle 2 closed 3 of the 5 Cycle 1 tech debts, exposed 4 new MCP tools + 1 new feature (`track.create`), and started the distribution track (DXT manifest, dev install script). Real smoke still depends on manual user execution (TD-004 stays open until the user runs the script in `docs/smoke-test.md`).

## Tech debt status

| ID | Status | Where |
|---|---|---|
| TD-001 (NaN env var) | ✅ CLOSED | `src/live-client/tcp-client.ts` — `parsePositiveInt()` function |
| TD-002 (track.list indexes) | ✅ CLOSED | `live/AbletonMind/handlers/track.py` + ADR-0002 |
| TD-003 (LIVE_API_FAILED naming) | ✅ CLOSED | `live/AbletonMind/errors.py`, `bridge.py` |
| TD-004 (real smoke) | 🟡 DOCUMENTED | `docs/smoke-test.md` — manual user execution |
| TD-005 (npm install did not run) | 🟡 ACCEPTED | depends on user's dev machine; no action possible in sandbox |

## Parity check (TS ↔ Python)

| Method | Bridge handler | TS MCP tool | Match |
|---|---|---|---|
| `system.hello` | `handlers/system.py` | `live-client/handshake.ts` (client) | ✅ |
| `system.ping` | `handlers/system.py` | (direct client) | ✅ |
| `transport.play` | `handlers/transport.py` | `tools/transport.ts::playTool` | ✅ |
| `transport.stop` | `handlers/transport.py` | `tools/transport.ts::stopTool` | ✅ NEW |
| `transport.set_tempo` | `handlers/transport.py` | `tools/transport.ts::setTempoTool` | ✅ NEW |
| `track.list` | `handlers/track.py` (new shape ADR-0002) | `tools/track.ts::trackListTool` | ✅ NEW shape synced |
| `track.create` | `handlers/track.py` NEW | `tools/track.ts::trackCreateTool` NEW | ✅ NEW |
| `clip.create_midi` | `handlers/clip.py` | `tools/clip.ts::createMidiClipTool` | ✅ NEW |

7 MCP tools registered (was 1 in Cycle 1).

## Contract drift

- `_workspace/contracts/phase0-methods.md` was **updated** to reflect ADR-0002 (new track.list shape) and add §9 (`track.create`).
- `_workspace/contracts/jsonrpc.md` **intact**.
- `ADR-0002` recorded in `_workspace/decisions/0002-track-list-shape.md`.

## Error code sync

| Code | TS (`ABLETON_MIND_ERRORS`) | Python (`errors.py`) |
|---|---|---|
| -32000 | LIVE_NOT_RUNNING | LIVE_NOT_RUNNING |
| -32001 | LIVE_API_CALL_FAILED | LIVE_API_CALL_FAILED ✅ (was LIVE_API_FAILED) |
| -32002 | OBJECT_NOT_FOUND | OBJECT_NOT_FOUND |
| -32003 | TYPE_MISMATCH | TYPE_MISMATCH |
| -32004 | OUT_OF_RANGE | OUT_OF_RANGE |
| -32005 | INVALID_STATE | INVALID_STATE |
| -32006 | TRANSACTION_ERROR | TRANSACTION_ERROR |
| -32007 | LISTENER_ERROR | LISTENER_ERROR |
| -32008 | KNOWLEDGE_LOOKUP_FAILED | KNOWLEDGE_LOOKUP_FAILED |

100% match.

## Added tests

Python (in `live/AbletonMind/tests/`):
- `test_handlers_track.py` fully rewritten for the new shape + 6 `track.create` cases (default append, specific index, named, OOR, bad type, undo wrap).

TS (in `tests/`):
- `tools-transport.test.ts` expanded: + 5 cases for `stop` and `set_tempo`.
- `tools-track.test.ts` NEW: 5 cases covering `trackListTool` + `trackCreateTool`.
- `tools-clip.test.ts` NEW: 3 cases for `createMidiClipTool` (including propagated TYPE_MISMATCH).

`tests/live-client.test.ts` remains the same and covers the TCP transport.

## Warnings (non-blocking)

### W1 — Nullable types on master_track
Accepted as design. In tests with FakeSong without master_track, it becomes `null`. In real runtime, `song.master_track` always exists. MCP tools that need to assume master always present should document it.

### W2 — Real smoke still pending (TD-004)
Phase 0 only officially closes when the user runs `docs/smoke-test.md` and reports PASS. No automated gate for this until macOS CI in Phase 7.

### W3 — `track_create` is not idempotent
Intentional decision (creating a track always creates). Phase 1+ may add `track_upsert` if UX is poor. Documented in the tool description.

### W4 — Dev install script only macOS+win32
`linux` raises an explicit error ("Ableton does not run natively"). Documented. No action.

## Recommendation for the architect

**PASS Cycle 2.** Moving TD-004 and TD-005 to "carry-over". Next cycle should:

1. **User runs `docs/smoke-test.md`** → reports PASS/FAIL. If PASS, Phase 0 closes officially.
2. **Phase 1 cont.:** ~15 more `ahujasid/ableton-mcp` tools (browser, load_instrument, set_clip_name, add_notes, fire_clip, etc.).
3. **knowledge-curator enters:** first device JSON (Wavetable) as proof of concept.
4. **distribution-docs cont.:** prepare `npm run build:dxt` that zips the `.mcpb`.
