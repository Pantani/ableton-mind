# Troubleshooting

Start with the smallest check that proves where the problem is: MCP client, Node server, TCP bridge or Live Remote Script.

## Live is not reachable

Ask the assistant:

> "Check ableton-mind connectivity without changing the set. Try `session_get_info`, then explain whether the MCP server, TCP bridge or Live Remote Script is failing."

Manual checks:

```bash
npm run build
node dist/cli/doctor.js
```

Then confirm Live has `AbletonMind` selected under Preferences -> Link, Tempo & MIDI -> Control Surface.

## Remote Script is not installed

From the repo:

```bash
npm run install:remote-script
```

Or copy `live/AbletonMind/` to:

- macOS: `~/Music/Ableton/User Library/Remote Scripts/AbletonMind/`
- Windows: `~/Documents/Ableton/User Library/Remote Scripts/AbletonMind/`

Restart Live after copying.

## npm or .mcpb install does not work

Public npm and release bundle channels are not published yet. Build from source until the final manual publish gate runs:

```bash
npm ci
npm run build
node dist/index.js
```

## A prompt changed too much

Use repair prompts instead of continuing blindly:

> "Snapshot the current set, compare it with the previous snapshot if available, and summarize only the real changes. Do not delete anything."

For destructive cleanup, ask the assistant to report the plan before it mutates Live.

## Device parameter errors

Ask the assistant to read the device schema first:

> "Call `device_get_parameters` for this device, then only set parameters that are present by exact name."

The knowledge base exists so the assistant does not guess parameter names.
