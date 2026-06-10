# Distribution

How `ableton-mind` reaches end users. Each channel serves a different audience.

## Release status

The source install path works today. Public npm, GitHub Release and `.mcpb` download channels are not published yet; `v0.1.0-rc.1` waits on TD-048 package validation.

## 1. Claude Desktop `.mcpb` (local build today, public bundle after RC)

One-click install. Build it with:

```bash
npm run build
npm run build:dxt
```

Drag the `.mcpb` file into Claude Desktop. It configures `claude_desktop_config.json` automatically.

User config (`host`, `port`, `log_level`) is editable through the Claude Desktop UI according to `dxt/manifest.json::user_config`.

## 2. npm (after publish)

```bash
npm install -g ableton-mind
ableton-mind
ableton-mind-doctor
```

Pre-1.0 uses `npm pack` or local install. CI validates `npm publish --dry-run`.
Current registry status: `ableton-mind` is not published on npm yet.

## 3. Docker

```bash
docker build -t ableton-mind .
docker run --rm -i --network host ableton-mind
```

### macOS / Linux

`--network host` works natively, so the container can reach `127.0.0.1:9876` on the host.

### Windows (TD-035)

Docker Desktop on Windows does not support `--network host` reliably for every scenario. Use one of these options:

**Option A — WSL2 backend (recommended).** Docker Desktop with WSL2:

```bash
# Inside WSL2 (Ubuntu, etc.):
docker run --rm -i --network host ableton-mind
```

The bridge must be reachable from the WSL network. Point `ABLETON_MIND_HOST` at the host IP:

```bash
docker run --rm -i \
  -e ABLETON_MIND_HOST=$(hostname -I | awk '{print $1}') \
  ableton-mind
```

**Option B — `host.docker.internal`.** Without `--network host`:

```bash
docker run --rm -i \
  -e ABLETON_MIND_HOST=host.docker.internal \
  -e ABLETON_MIND_PORT=9876 \
  -p 9876:9876 \
  ableton-mind
```

Ableton Live must accept external connections. The default Remote Script listens on `0.0.0.0` if you set `ABLETON_MIND_HOST=0.0.0.0` in the User Library environment.

**Option C — Skip Docker on Windows.** Use the source install path today, or the `.mcpb` bundle after RC. Docker is primarily for Linux/CI deployment.

## 4. Smithery

[`smithery.yaml`](../smithery.yaml) is configured. After v0.1.0, publish with:

```bash
smithery publish
```

Smithery hosts the container and creates an MCP endpoint. Users point Claude Desktop at the Smithery URL. This is a release-path channel, not a published public listing yet.

## 5. Dev Install

Developer mode uses a symlink instead of a copy.

```bash
node scripts/install-remote-script.mjs
node scripts/install-remote-script.mjs --check
```

Repo edits reflect directly in Live. Reopen the Control Surface to reload.

## 5b. CI / Release Secrets (TD-040)

Workflows under `.github/workflows/` need secrets configured in **GitHub -> Settings -> Secrets and variables -> Actions**:

| Secret | Used by | How to generate |
|---|---|---|
| `NPM_TOKEN` | `release.yml` `npm publish` step (only tags `v1.x.x+`; pre-1.0 skips) | npmjs.com -> Access Tokens -> Automation token. Granular access is OK if it can publish `ableton-mind`. |
| `GITHUB_TOKEN` | `release.yml` push to ghcr.io + create Release | Automatic; GitHub Actions injects it. |

Required `GITHUB_TOKEN` permissions are already declared in the workflow:

- `contents: write` — create Release and upload `.mcpb`.
- `packages: write` — push to `ghcr.io/<owner>/ableton-mind`.
- `id-token: write` — npm provenance (Sigstore signing).

### Smithery (optional)

For automatic Smithery sync:

- `SMITHERY_API_KEY` — generated at <https://smithery.ai/settings>.
- Add a release workflow step: `smithery publish`.

Cycle 13 did not include the Smithery step; it remains for v0.1.0.

### Test a Release Locally

```bash
# Dry-run without publishing
npm publish --dry-run

# Build artifact without publishing
git tag v0.0.0-test
git push origin v0.0.0-test
git tag -d v0.0.0-test
git push origin :v0.0.0-test
```

## 6. Doctor CLI

```bash
npx ableton-mind-doctor
```

The doctor checks Node >= 20, Remote Script install, port 9876, valid knowledge and valid recipes.
