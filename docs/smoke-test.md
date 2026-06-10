# Smoke Test

Manual checklist for validating the TypeScript server, Python bridge and Ableton Live end to end. This is the Phase 0 closing gate because it requires the Live GUI.

## Prerequisites

- macOS primary path; Windows follows the same flow with adjusted paths.
- Ableton Live 12.x installed and activated.
- Node 20+ on PATH.
- Repo cloned locally.
- `npm ci` or `npm install` completed at the repo root.

## 1. Install the Python Bridge

```bash
node scripts/install-remote-script.mjs --check
node scripts/install-remote-script.mjs
```

Expected output shows the repo source, the Live Remote Scripts target and a created symlink or copy.

## 2. Activate in Live

1. Open or restart Ableton Live 12.
2. Open Preferences -> Link, Tempo & MIDI.
3. In an empty Control Surface slot, choose `AbletonMind`.
4. Open Help -> Show Log File if needed and search for `AbletonMind`.

The bridge should listen on port 9876:

```bash
lsof -nP -iTCP:9876 -sTCP:LISTEN
```

## 3. Build the Server

```bash
npm run build
```

Expected: `dist/index.js` exists and TypeScript build succeeds.

## 4. Manual Handshake

Before using an MCP client, validate the bridge directly:

```bash
printf '{"jsonrpc":"2.0","id":1,"method":"system.hello","params":{"client":"manual","version":"0.0.0"}}\n' | nc 127.0.0.1 9876
```

Expected: one JSON-RPC response containing bridge version, Live version, Python version and `protocol_version`.

If this hangs or returns connection refused, the Remote Script was not loaded or the Control Surface slot was not activated.

## 5. Ping, Play and Stop by Netcat

```bash
printf '%s\n%s\n%s\n' \
  '{"jsonrpc":"2.0","id":1,"method":"system.ping"}' \
  '{"jsonrpc":"2.0","id":2,"method":"transport.play","params":{"from_beginning":false}}' \
  '{"jsonrpc":"2.0","id":3,"method":"transport.stop"}' \
  | nc 127.0.0.1 9876
```

Expected: three responses. Live starts playing for request 2 and stops for request 3.

## 6. Smoke Through an MCP Client

Point Claude Desktop, Cursor or another MCP client at `dist/index.js`. Example Claude Desktop config:

```json
{
  "mcpServers": {
    "ableton-mind": {
      "command": "node",
      "args": ["/absolute/path/to/ableton-mind/dist/index.js"],
      "env": {
        "ABLETON_MIND_LOG_LEVEL": "debug"
      }
    }
  }
}
```

Restart the client and ask it to call the `play` tool. Expected response includes `{ ok: true, verified: true, is_playing: true }` and Live starts playback.

Then test in this order:

1. `track_list` lists regular, return and master tracks.
2. `set_tempo` with `bpm=140` updates Live.
3. `track_create` with `type=midi` creates a MIDI track.
4. `create_midi_clip` creates an empty clip in a target session slot.

## 7. PASS Criteria

| Criterion | How to verify |
|---|---|
| Handshake returns protocol version | Step 4 |
| Play/stop reflect in Live transport | Step 5 |
| MCP `play` works through the client | Step 6 |
| Live undo reverses `track_create` in one step | Manual Cmd+Z after Step 6 |
| `play` is idempotent | Calling twice returns changed true, then changed false |

If every criterion passes, Phase 0 is closed. Record date, Live version and evidence in `_workspace/PROGRESS.md` and the matching QA report.

## 8. Common Failures

- `connection refused` on port 9876: Remote Script did not load. Check Live's Log File for Python exceptions.
- `protocol_version mismatch`: server and bridge versions are out of sync.
- Live freezes on a tool call: a handler likely touched LiveAPI off the main thread.

## 9. Revert

```bash
rm ~/Music/Ableton/User\ Library/Remote\ Scripts/AbletonMind
```

Restart Live and clear the AbletonMind Control Surface slot.
