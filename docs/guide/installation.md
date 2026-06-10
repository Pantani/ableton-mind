# Installation

Four channels. Pick by audience.

## 1. Claude Desktop `.mcpb` (recommended)

One-click bundle. Download `ableton-mind.mcpb` from the [latest release](https://github.com/Pantani/ableton-mind/releases) and double-click. Claude Desktop registers the server and runs the Remote Script setup automatically.

## 2. npm global

```bash
npm install -g ableton-mind
ableton-mind install:remote-script
```

`claude_desktop_config.json`:

```json
{
  "mcpServers": {
    "ableton-mind": { "command": "ableton-mind" }
  }
}
```

## 3. Docker

```bash
docker run --rm -it \
  -e ABLETON_MIND_HOST=host.docker.internal \
  ghcr.io/pantani/ableton-mind:latest
```

## 4. Smithery

Listing in `smithery.yaml`.

Full details in [Distribution](../distribution).
