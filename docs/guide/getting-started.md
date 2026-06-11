# Getting started

`ableton-mind` is an MCP server that lets an AI assistant create, inspect and verify Ableton Live sets. This page takes you from a local checkout to your first verified tool call.

## Prerequisites

- **Node.js 20+**
- **Ableton Live 12**. The real smoke pass used Live 12.4.1 on macOS.
- An MCP client such as Claude Desktop, Claude Code, Codex or Cursor.

## 1. Build from source

For development, use the source path:

```bash
npm ci
npm run build
```

## 2. Install the Remote Script (Python bridge)

The Remote Script runs **inside Live** and exposes the LOM over TCP at `127.0.0.1:9876`.

```bash
npm run install:remote-script
```

Or manually copy `live/AbletonMind/` to:

- **macOS:** `~/Music/Ableton/User Library/Remote Scripts/AbletonMind/`
- **Windows:** `~/Documents/Ableton/User Library/Remote Scripts/AbletonMind/`

## 3. Activate in Live

**Live → Preferences → Link/Tempo/MIDI → Control Surface → AbletonMind**.

## 4. Point your MCP client at the local build

Example `claude_desktop_config.json`:

```json
{
  "mcpServers": {
    "ableton-mind": {
      "command": "node",
      "args": ["/absolute/path/to/ableton-mind/dist/index.js"]
    }
  }
}
```

Replace the path with this repo's absolute path after `npm run build`.

## 5. First read

Ask Claude/Cursor:

> "Check that ableton-mind can reach Live. Read the session info and list the tracks. Do not change anything."

Then try:

> "Play the set, verify playback state, then stop."

The assistant should return a verified state and a small diff. From there, continue with [Your first Live set](./first-live-set) or the [prompt cookbook](./prompt-cookbook).
