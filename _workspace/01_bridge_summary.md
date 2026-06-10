# Cycle 1 — Bridge Track (python-bridge-engineer)

**Status:** DELIVERED (the original agent suffered a socket API error after writing files; this summary was reconstituted by the architect via inspection).

## Files created (21 .py + 1 .md)

```
live/
├── __init__.py
└── AbletonMind/
    ├── __init__.py                # ControlSurface entry
    ├── README.md                  # install paths macOS/Windows
    ├── bridge.py                  # TCP NDJSON server + JSON-RPC dispatcher
    ├── errors.py                  # RpcError + codes -32000..-32008
    ├── log.py                     # StructuredLogger
    ├── schemas.py                 # I/O dataclasses (7 inputs)
    ├── transactions.py            # `with undo_step(name, song):`
    └── handlers/
        ├── __init__.py            # populates REGISTRY via import
        ├── _base.py               # Handler base + @register decorator
        ├── system.py              # system.hello, system.ping
        ├── transport.py           # play, stop, set_tempo
        ├── track.py               # list (read-only)
        └── clip.py                # create_midi (transactional)
    └── tests/
        ├── __init__.py
        ├── _fakes/                # LiveAPI mock fixtures
        │   ├── __init__.py
        │   └── live_api.py
        ├── test_bridge.py
        ├── test_handlers_system.py
        ├── test_handlers_transport.py
        ├── test_handlers_track.py
        └── test_handlers_clip.py
```

## Intermediate decisions

### Threading
- TCP server runs in a **daemon thread**. Each client also in a daemon thread.
- Dispatch via `queue.Queue` to Live's main thread.
- `ctrl.schedule_message(50, _drain_queue)` wakes the main thread every ~50ms to drain the queue.
- The socket thread blocks on `result_q.get(timeout=10s)` waiting for the response.
- **`headless=True` mode**: if no ControlSurface is provided (tests, smoke outside of Live), dispatch synchronously on the socket thread. Enables deterministic tests without Live open.

### NDJSON framing
- Per-client partial buffer (`buffer += chunk; split(b"\n", 1)` loop).
- `socket.timeout(0.5)` on accept to allow clean shutdown.
- `SO_REUSEADDR` set to avoid `[Errno 48]` on restart.

### Exception mapping (in dispatcher)
- `json.JSONDecodeError` → `-32700` parse error
- `TypeError` when constructing input dataclass → `-32602` invalid params
- `KeyError` in REGISTRY → `-32601` method not found
- `RpcError` (raised by handler) → uses `exc.code/message/data`
- Any other `Exception` → `-32001` LIVE_API_FAILED with `exception` (classname) + `reason` (str)

### Idempotency
All mutation handlers follow read-before-write:
- `transport.play` reads `is_playing`, only calls `start_playing()` if needed.
- `transport.stop` same.
- `transport.set_tempo` compares with 1e-3 tolerance before setting (avoids useless undo step).
- `clip.create_midi` verifies the slot is empty first; if occupied, raises `-32005` with `existing_clip_name`.

### Transactions
`with undo_step(name, song):` wraps `begin_undo_step()`/`end_undo_step()` in try/finally. The only real use in Phase 0 is `clip.create_midi`; the pattern is ready for all Phase 1+ mutators.

## Open risks / TODOs

- **Master/return indexing** in `track.list` is provisional (-1 master, -2..-N returns). Phase 1 will expose `song.tracks`, `song.return_tracks`, `song.master_track` as separate collections (alignment with PLAN.md §4.2).
- `_python_version()` in `system.py` reports the version of the running interpreter; in Live 12 it should be 3.11.x. No coverage for Live 11 / Py 3.7 — Phase 1 must test compat.
- Error message `-32001` returns `exception` (classname) + `reason` (str) — does not include stack trace for privacy. Phase 1 can add a debug flag.
- Smoke test against real Live has not run yet — deferred to Cycle 2 or 3.

## How to run tests offline

```bash
cd /Users/pantani/Desktop/projects/art/ableton-mind
python -m unittest discover -s live/AbletonMind/tests -v
```

All tests use the fake `live/AbletonMind/tests/_fakes/live_api.py` in place of the real `Live.Application`, so they run without Ableton open.

## Notes for the architect

- Contracts were NOT mutated (`_workspace/contracts/{jsonrpc,phase0-methods}.md` preserved).
- Implementation 100% within the briefing scope — no deviation.
- The original agent (`python-bridge-engineer`) crashed with an API error while writing this summary; the code files were all on disk. This summary is a reconstitution via inspection by the architect.
