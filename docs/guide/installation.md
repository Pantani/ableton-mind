# Installation

The fastest install paths are now **npm global** or the GitHub Release `.mcpb`. Use source install when developing the repo or testing local changes.

## 1. Source install

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

## 3. Claude Desktop `.mcpb`

Download `ableton-mind-0.1.0.mcpb` from the [v0.1.0 GitHub Release](https://github.com/Pantani/ableton-mind/releases/tag/v0.1.0), then drag it into Claude Desktop.

The repo can also build a bundle locally:

```bash
npm run build:dxt
```

Drag the generated `.mcpb` into Claude Desktop.

## 4. npm global

```bash
npm install -g ableton-mind
ableton-mind
ableton-mind-doctor
```

Current registry status: `ableton-mind@0.1.0` is published on npm.

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

`smithery.yaml` is present for the listing path. Hosted Smithery indexing can lag the repository metadata.

Full details in [Distribution](../distribution).
