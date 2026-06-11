# Distribution

How `ableton-mind` reaches end users for the `0.1.0` release.

## Release status

`0.1.0` is published on npm, GitHub Releases and the official MCP Registry. Glama has a server listing, but a Glama hosted release is a separate release action that must be completed in the Glama admin UI. Smithery metadata is present in `smithery.yaml`, but the hosted listing can lag indexing. Do not assume ghcr.io is live without checking the container registry.

Ableton integration has two pieces:

- MCP server: Node.js process launched by Claude Desktop, Codex, Cursor, npm, Docker, Smithery, or another MCP client.
- Remote Script: Python files under `live/AbletonMind/` that must be installed into Ableton Live's User Library and activated in Live preferences.

Hosted channels can run the MCP server, but they cannot control a local Ableton Live instance unless the Remote Script bridge is reachable from that server.

The Remote Script bridge binds to `127.0.0.1` by default and rejects non-loopback hosts unless `ABLETON_MIND_ALLOW_REMOTE=1` is set. Use that only behind a trusted OS/network boundary.

## Source install

Use this path when developing the repo or validating a local checkout.

```bash
npm ci
npm run build
npm run install:remote-script
npm run test:bridge
npm start
```

Developer install uses a symlink by default. Reopen Live's Control Surface after edits to reload the script.

```bash
node scripts/install-remote-script.mjs --check
node scripts/install-remote-script.mjs --copy --force
```

## npm

Install from npm:

```bash
npm install -g ableton-mind
ableton-mind-install-remote-script
ableton-mind-doctor
ableton-mind
```

The npm package includes:

- compiled server in `dist/`
- runtime recipes and knowledge assets
- `live/AbletonMind/` Remote Script runtime without tests/cache
- `ableton-mind-install-remote-script` for installing the Remote Script into Ableton's User Library
- registry/listing metadata files

Validate the package before publishing:

```bash
npm pack --dry-run --json
npm publish --dry-run
```

## Claude Desktop `.mcpb`

Build locally:

```bash
npm run build
npm run build:mcpb
```

Install by dragging `build/ableton-mind-0.1.0.mcpb` into Claude Desktop or by using an MCPB installer.

The bundle installs and runs the Node MCP server. It also includes the Remote Script files and installer script for reference, but Claude Desktop does not automatically copy those files into Ableton Live. Install the Remote Script separately through the npm/source installer, then activate it in Live:

Live -> Preferences -> Link/Tempo/MIDI -> Control Surface -> AbletonMind.

## MCP Registry

`server.json` is the MCP Registry manifest. It uses `mcpName`/server name:

```text
io.github.Pantani/ableton-mind
```

Before submission, verify version sync:

```bash
node -e "const p=require('./package.json'),s=require('./server.json'); console.log(p.version, p.mcpName, s.name, s.version, s.packages[0].version)"
```

`0.1.0` is published as an active latest version in the official MCP Registry. Re-run `mcp-publisher validate` before publishing any future version.

## Smithery and Glama

`smithery.yaml` and `glama.json` are listing metadata for hosted catalog channels. Glama is listed at:

```text
https://glama.ai/mcp/servers/Pantani/ableton-mind
```

A Glama listing is not the same thing as a Glama release. To create the hosted Glama release, use maintainer access on Glama:

1. Claim the server from the Glama server score/listing flow if it has not been claimed yet.
2. Open the Dockerfile admin page:

```text
https://glama.ai/mcp/servers/Pantani/ableton-mind/admin/dockerfile
```

3. Configure the build spec, command arguments, environment variable schema and placeholder parameters.
4. Click Deploy and wait for the build test to start the MCP server successfully.
5. Click Make Release, enter the version and publish.

Suggested Glama admin values for this repo:

- Build steps:

```json
["npm ci", "npm run build"]
```

- CMD arguments:

```json
["node", "dist/index.js"]
```

- Required environment variables: none
- Optional environment variables: `ABLETON_MIND_HOST`, `ABLETON_MIND_PORT`, `ABLETON_MIND_LOG_LEVEL`, `ABLETON_MIND_TIMEOUT_MS`

Use Glama's guide for the exact current UI labels: https://glama.ai/blog/2026-03-15-how-to-make-a-release

```bash
smithery publish
```

Hosted Smithery/Glama listings are useful for discovery and remote MCP server hosting. They still need network access to the user's local Ableton bridge. For most musicians, local npm or `.mcpb` is the primary install path.

## Docker and ghcr.io

Local build:

```bash
docker build -t ableton-mind .
docker run --rm -i --network host ableton-mind
```

Release workflow tags for stable releases:

```text
ghcr.io/pantani/ableton-mind:v0.1.0
ghcr.io/pantani/ableton-mind:latest
```

Prerelease tags keep only their exact version tag and do not move `latest`.

### macOS / Linux

`--network host` lets the container reach `127.0.0.1:9876` on Linux. On macOS Docker Desktop, `host.docker.internal` is usually more reliable:

```bash
docker run --rm -i \
  -e ABLETON_MIND_HOST=host.docker.internal \
  -e ABLETON_MIND_PORT=9876 \
  ableton-mind
```

### Windows

Docker Desktop networking varies by backend. Prefer WSL2 when possible:

```bash
docker run --rm -i \
  -e ABLETON_MIND_HOST=host.docker.internal \
  -e ABLETON_MIND_PORT=9876 \
  ableton-mind
```

If the container cannot reach the bridge, use npm or `.mcpb` locally instead.

For a container or hosted MCP server that truly needs to reach Live from another host, set `ABLETON_MIND_HOST` on the Remote Script side and opt in with `ABLETON_MIND_ALLOW_REMOTE=1`. Do not expose the bridge on an untrusted network.

## Release workflow

`.github/workflows/release.yml` runs on `v*` tags. It verifies manifest version sync, runs typecheck/lint/tests/build, builds the `.mcpb`, creates or updates the GitHub Release, pushes ghcr.io images, and publishes npm only when explicitly enabled.

npm behavior:

- prerelease tags containing `-` are skipped
- stable tags publish only when `ABLETON_MIND_AUTO_NPM_PUBLISH=true` and `NPM_TOKEN` is configured
- manual npm publish remains the default for `0.1.0`

Required GitHub Actions secrets/variables:

| Name | Used by |
|---|---|
| `NPM_TOKEN` | optional npm publish with provenance |
| `ABLETON_MIND_AUTO_NPM_PUBLISH` | repository variable that opts into automatic npm publish |
| `GITHUB_TOKEN` | automatic GitHub Release and ghcr.io push |

## Doctor CLI

```bash
ableton-mind-doctor
```

The doctor checks Node, Remote Script installation, bridge reachability, knowledge assets, recipes and MCP primitive imports.
