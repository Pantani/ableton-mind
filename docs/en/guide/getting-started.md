# Getting started

`ableton-mind` is an MCP server exposing the full Live Object Model to LLMs. This page takes you from zero to your first `play` in Live.

## Prerequisites

- **Node.js 20+**
- **Ableton Live 12** (11 support comes late in Phase 1). macOS first.
- An MCP client — **Claude Desktop**, **Cursor**, **Continue**, etc.

## 1. Install

See [Installation](./installation) for all four channels. Quick path:

```bash
npm install -g ableton-mind
```

## 2. Install the Remote Script (Python bridge)

The Remote Script runs **inside Live** and exposes the LOM over TCP at `127.0.0.1:9876`.

```bash
ableton-mind install:remote-script
```

Or manually copy `live/AbletonMind/` to:

- **macOS:** `~/Music/Ableton/User Library/Remote Scripts/AbletonMind/`
- **Windows:** `~/Documents/Ableton/User Library/Remote Scripts/AbletonMind/`

## 3. Activate in Live

**Live → Preferences → Link/Tempo/MIDI → Control Surface → AbletonMind**.

## 4. Point your MCP client

Example `claude_desktop_config.json`:

```json
{
  "mcpServers": {
    "ableton-mind": { "command": "ableton-mind" }
  }
}
```

## 5. First `play`

Ask Claude/Cursor:

> "Play the set."

The LLM calls `play`. The tool returns `{ ok, verified: { is_playing: true }, diff: { is_playing: false → true } }`.
