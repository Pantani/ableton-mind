# Release 0.1.0 Distribution Summary

Date: 2026-06-10

## Scope

Distribution closure for `ableton-mind@0.1.0`: npm package, `.mcpb`, MCP Registry metadata, Smithery/Glama metadata, Docker/ghcr workflow behavior, and EN/PT distribution docs.

## Changed Files

- `package.json`
  - Bumped to `0.1.0`.
  - Added `mcpName: "io.github.Pantani/ableton-mind"`.
  - Added `ableton-mind-install-remote-script` bin.
  - Added published runtime files for `live/AbletonMind/`, installer script, and metadata manifests.
  - Normalized `repository.url` to npm's `git+https://...` form.
- `package-lock.json`
  - Synced root package version and bin metadata to `0.1.0`.
- `dxt/manifest.json`
  - Synced to `0.1.0`.
  - Added required prompt `text` fields.
  - Removed unsupported top-level `resources` from the MCPB manifest while leaving MCP resources in the server.
- `server.json`
  - Synced top-level and package versions to `0.1.0`.
- `safeskill.manifest.json`
  - Synced version to `0.1.0`.
- `smithery.yaml`
  - Updated tool count to 33.
- `.github/workflows/release.yml`
  - Clarified npm auto-publish behavior.
  - Prevented prerelease tags from moving the Docker `latest` tag.
- `scripts/build-dxt.mjs`
  - Bundles Remote Script runtime files, installer script, and registry metadata into `.mcpb`.
  - Excludes Python tests/cache/bytecode from the bundle.
- `.npmignore`
  - No longer excludes the runtime Remote Script, installer script, or changelog.
- `docs/distribution.md` and `docs/pt/distribution.md`
  - Rewritten for source, npm, `.mcpb`, MCP Registry, Smithery/Glama, Docker/ghcr, and hosted-cloud limitations.

## Verification

- `npm run build:mcpb`: PASS, generated `build/ableton-mind-0.1.0.mcpb`, 166 entries, 270.2 KB, sha256 prefix `e56210c63d2c`.
- `npm run build:dxt:check`: PASS.
- `npx --yes @anthropic-ai/mcpb validate dxt/manifest.json`: PASS.
- `npm pack --dry-run --json`: PASS, 181 entries; includes server, Remote Script runtime, installer, metadata and excludes tests/cache/pyc.
- `npm publish --dry-run`: PASS.
- `npm run docs:build`: PASS.
- GitHub action versions verified by `git ls-remote`: `actions/checkout@v6` and `actions/setup-node@v6` tags exist.

## Release Notes

- `.mcpb` installs/runs the Node MCP server and includes Remote Script files for user access, but does not claim to automatically install the Ableton Remote Script.
- Smithery/Glama are valid discovery/hosting channels for the MCP server, but hosted cloud needs network access to the user's local Ableton bridge.
- No publish/tag/push/release/registry/Docker push was performed.
