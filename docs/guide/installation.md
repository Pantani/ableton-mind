# Installation

The current working path is **source install**. Public npm, GitHub Release and one-click `.mcpb` channels are wired in the repo, but they are not published yet.

## 1. Source install (current)

```bash
git clone https://github.com/Pantani/ableton-mind.git
cd ableton-mind
npm ci
npm run build
npm run install:remote-script
```

Then enable `AbletonMind` in Live:

**Live -> Preferences -> Link, Tempo & MIDI -> Control Surface -> AbletonMind**.

## 2. MCP client config

For a local source checkout, point the client at `dist/index.js`:

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

Use the absolute path from your machine.

## 3. Claude Desktop `.mcpb` (after RC)

The repo can build a bundle locally:

```bash
npm run build:dxt
```

Drag the generated `.mcpb` into Claude Desktop. Public downloads will be linked after `v0.1.0-rc.1`.

## 4. npm global (after publish)

Planned command after publication:

```bash
npm install -g ableton-mind
ableton-mind
ableton-mind-doctor
```

Current registry status: `ableton-mind` is not published on npm yet.

## 5. Docker

Build locally:

```bash
docker build -t ableton-mind .
docker run --rm -i --network host ableton-mind
```

On macOS/Windows Docker Desktop, you may need `host.docker.internal` for the bridge host:

```bash
docker run --rm -it \
  -e ABLETON_MIND_HOST=host.docker.internal \
  ableton-mind
```

## 6. Smithery

`smithery.yaml` is present for the release path. Publish after the RC/package gates are green.

Full details in [Distribution](../distribution).
