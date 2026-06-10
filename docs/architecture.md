# Architecture

This page describes the technical split between the MCP server, the Live Remote Script and the embedded knowledge/recipe layer.

## 1. Three Layers

```
LLM / IDE
  -> MCP stdio (JSON-RPC over stdin/stdout)
ableton-mind server
  -> TCP NDJSON JSON-RPC 2.0 on 127.0.0.1:9876
AbletonMind Remote Script
  -> Live Object Model inside Ableton Live
```

| Layer | Runs where | Language | Main stack |
|---|---|---|---|
| MCP server | Separate process launched by the MCP client | TypeScript | `@modelcontextprotocol/sdk`, `zod`, `tsup`, `vitest`, `biome` |
| Bridge / Remote Script | Inside Live as a Control Surface | Python 3.7/3.11 | stdlib + LiveAPI |
| Knowledge + recipes | Embedded static package data | JSON | Zod-validated loaders |

## 2. Why This Split

1. TypeScript gives the server strong Zod validation and the most mature MCP SDK path.
2. Python is required for the bridge because Remote Scripts and LiveAPI run inside Live.
3. TCP isolates failures: a server bug should not crash Live. JSON-RPC gives structured requests, responses, notifications and errors.

## 3. Bridge Protocol

The canonical contract is in [`_workspace/contracts/jsonrpc.md`](../_workspace/contracts/jsonrpc.md).

- Transport: TCP NDJSON. Each message is one UTF-8 JSON line ending in `\n`.
- Envelope: JSON-RPC 2.0 request, response or notification.
- Method names: `{domain}.{verb}`, for example `transport.play` and `track.list`.
- Custom errors: `-32000..-32099`, with actionable `error.data`.
- Mutations are idempotent and return read-back data such as `{ changed, before, after }`.
- Composite mutations use Live undo steps so Cmd+Z is unitary.

## 4. Handshake

The server sends `system.hello` immediately after connecting:

```json
{
  "jsonrpc": "2.0",
  "id": 1,
  "method": "system.hello",
  "params": { "client": "ableton-mind/ts", "version": "0.0.21" }
}
```

The bridge responds with bridge version, Live version, Python version and protocol version.

## 5. Tool Call Flow

For `play`:

1. The MCP client calls the `play` tool.
2. The server validates input with Zod.
3. The server calls the bridge method `transport.play`.
4. The bridge schedules LiveAPI work on Live's main thread.
5. The bridge reads state, starts playback only if needed, then reads back state.
6. The server returns `{ ok, verified, changed, is_playing, current_song_time, diff }`.

## 6. File Layout

```text
ableton-mind/
├─ src/                         # TypeScript MCP server
│  ├─ index.ts                  # stdio entrypoint
│  ├─ server/                   # MCP plumbing
│  ├─ live-client/              # TCP NDJSON + handshake
│  ├─ tools/                    # MCP tools
│  ├─ resources/                # MCP resources
│  ├─ prompts/                  # MCP prompts
│  ├─ knowledge/                # embedded device/scales data
│  └─ recipes/                  # recipe loader/runner
├─ live/AbletonMind/            # Python Remote Script
│  ├─ bridge.py                 # TCP server + dispatcher
│  ├─ handlers/                 # transport, track, clip, system, ...
│  ├─ listeners.py              # LiveAPI subscriptions
│  ├─ transactions.py           # undo-step helpers
│  └─ tests/                    # offline unittest coverage
├─ docs/                        # VitePress English root
├─ docs/pt/                     # localized VitePress pages
├─ recipes/                     # runtime-distributed recipe JSON
├─ dxt/                         # MCPB/DXT manifest
└─ _workspace/                  # harness state, contracts, ADRs and QA
```

## 7. Remote Script Install Paths

- macOS: `~/Music/Ableton/User Library/Remote Scripts/AbletonMind/`
- Windows: `~/Documents/Ableton/User Library/Remote Scripts/AbletonMind/`

After copying or symlinking the folder, enable `AbletonMind` in Live under Preferences -> Link, Tempo & MIDI -> Control Surface.

## 8. Threading

LiveAPI must run on Live's main thread. The TCP server runs on a daemon thread, queues JSON-RPC work into the ControlSurface scheduler and sends the result back to the socket thread when complete.

## 9. Design Invariants

Every tool follows the PLAN.md invariants:

1. Idempotent.
2. Transactional when it mutates multiple Live objects.
3. Reversible for destructive operations.
4. Read-before-write.
5. Schema-aware for device parameters.
6. Returns `{ ok, verified, diff }`, not just `ok`.
