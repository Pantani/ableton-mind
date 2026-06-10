# AbletonMind — Remote Script (Phase 0)

NDJSON JSON-RPC 2.0 TCP server that runs inside Ableton Live as a
`Control Surface`. It exposes the Live API to the TypeScript MCP server.

- Default port: `127.0.0.1:9876` (override via `ABLETON_MIND_HOST` /
  `ABLETON_MIND_PORT`).
- Stdlib only; no pip dependencies.
- Live 12 / Python 3.11 is the Phase 0 priority. Live 11 / Python 3.7
  compatibility stays for Phase 1.

## Installation

Copy the `live/AbletonMind/` folder to Live's Remote Scripts directory:

### macOS

```
~/Music/Ableton/User Library/Remote Scripts/AbletonMind/
```

Example from the repo root:

```bash
ln -s "$(pwd)/live/AbletonMind" \
  "$HOME/Music/Ableton/User Library/Remote Scripts/AbletonMind"
```

### Windows

```
%USERPROFILE%\Documents\Ableton\User Library\Remote Scripts\AbletonMind\
```

PowerShell:

```powershell
New-Item -ItemType Junction `
  -Path "$env:USERPROFILE\Documents\Ableton\User Library\Remote Scripts\AbletonMind" `
  -Target "$(Resolve-Path .\live\AbletonMind)"
```

## Activation in Live

1. Live -> Settings (or Preferences) -> **Link, Tempo & MIDI**.
2. Under **Control Surface**, choose `AbletonMind`.
3. Leave Input / Output as `None`.
4. Live's Log.txt should show `AbletonMind started on 127.0.0.1:9876`.

`Log.txt` locations:

- macOS: `~/Library/Preferences/Ableton/Live <version>/Log.txt`
- Windows: `%USERPROFILE%\AppData\Roaming\Ableton\Live <version>\Preferences\Log.txt`

## Phase 0 Methods

| Method | Idempotent? | Transactional? |
|---|---|---|
| `system.hello` | n/a | no |
| `system.ping` | n/a | no |
| `transport.play` | yes | no |
| `transport.stop` | yes | no |
| `transport.set_tempo` | yes | no |
| `track.list` | n/a (read-only) | no |
| `clip.create_midi` | yes (rejects occupied slot) | yes |

See `_workspace/contracts/phase0-methods.md` for the full params and return
schema.

## Offline Tests

```bash
cd <repo root>
python -m unittest discover -s live/AbletonMind/tests -t .
```

The LiveAPI fakes live in `live/AbletonMind/tests/_fakes/live_api.py`.
No test depends on Live being open.

## Smoke Against Real Live

Not run in this cycle; left for Cycle 2 (architect + qa-integration smoke).
