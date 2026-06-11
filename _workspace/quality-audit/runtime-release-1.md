# Runtime Release Audit 1

**Date:** 2026-06-10
**Mode:** read-only, no publish/write gates

## Result

The npm artifact, DXT/MCPB bundle, Docker build and central manifest version sync pass local checks. I would not release yet without resolving or explicitly waiving the stale-bridge blocker: the current Live bridge responds as `0.0.21` while this checkout/package is `0.1.0`, so runtime smoke does not prove this release candidate.

## Checks

- Version sync: PASS for `package.json`, `package-lock.json`, `dxt/manifest.json`, `server.json`, `server.json::packages[0].version`, `safeskill.manifest.json`.
- `npm run build:dxt:check`: PASS.
- `npm pack --dry-run --json`: PASS, 181 entries, 233016 bytes.
- `npm publish --dry-run --access public`: PASS, no real publish.
- `npm run build:mcpb`: PASS, 166 entries, 307.4 KB.
- `node dist/cli/doctor.js`: PASS-WITH-WARNING, misses stale Remote Script target.
- `node dist/index.js`: PASS-WITH-WARNING, starts server and connects to stale bridge `0.0.21`.
- `docker build -t ableton-mind:audit .`: PASS.
- `npm audit --omit=dev`: PASS.

## Findings

### BLOCKER: Live smoke does not prove this checkout/release

- Evidence: package/manifests are `0.1.0`; startup handshake reports bridge version `0.0.21`; installed Remote Script symlink points to `/Users/pantani/Desktop/projects/art/ableton-mind/live/AbletonMind`, not this worktree.
- Risk: release could be approved while Live runs another checkout.
- Suggested fix: reinstall/reactivate Remote Script from this checkout, restart Live, and add a doctor check comparing bridge `system.hello.version` with package version.
- Verification: `node dist/index.js` should log bridge version `0.1.0`; `node dist/cli/doctor.js` should fail/warn on bridge/package version mismatch.

### MAJOR: Runtime TS versions are hard-coded and stale

- Evidence: `src/index.ts` and `src/live-client/handshake.ts` contain `0.0.x` version constants while package is `0.1.0`.
- Risk: logs, handshake and MCP metadata are inconsistent with release artifacts.
- Suggested fix: centralize version metadata.
- Verification: startup smoke and tests show `0.1.0`.

### MAJOR: Release workflow misses several release gates

- Evidence: release workflow runs typecheck/lint/test/build/MCPB, but not `test:bridge`, docs build, pack dry-run, MCPB validator or `npm audit --omit=dev` before release/Docker/npm steps.
- Risk: tag workflow can publish assets without validating Python bridge, docs or package contents.
- Suggested fix: add these gates before any asset upload/push/publish.
- Verification: failing any gate should stop before GitHub Release upload, Docker push or npm publish.

### MAJOR: DXT manifest lists 6 tools while runtime exposes 33

- Evidence: `dxt/manifest.json` has 6 `tools`; server runtime registers 33.
- Risk: bundle metadata is stale/partial.
- Suggested fix: generate tools from registry or remove stale static list if optional.
- Verification: test comparing manifest tools with `allTools`.

### MINOR: Docker build is not lockfile-strict

- Evidence: Dockerfile uses `npm install` instead of `npm ci`.
- Risk: image dependency resolution can drift.
- Suggested fix: use `npm ci` and `npm ci --omit=dev`.
- Verification: `docker build -t ableton-mind:audit .`.

### MINOR: Package includes source maps despite ignore policy

- Evidence: package dry-run includes `dist/index.js.map` and `dist/cli/doctor.js.map`; `.npmignore` attempts to exclude maps, but `package.json.files` includes `dist`.
- Risk: package contents differ from apparent ignore policy.
- Suggested fix: decide policy; either publish maps intentionally and update docs/ignore, or remove/disable maps before pack.
- Verification: `npm pack --dry-run --json`.

### MINOR: Installer bin is not executable in the checkout

- Evidence: `scripts/install-remote-script.mjs` has a shebang but pack dry-run reports mode `420`.
- Risk: npm shims usually work, but direct POSIX execution/symlink may fail.
- Suggested fix: mark file executable and add a bin-mode test.
- Verification: temp global install and `ableton-mind-install-remote-script --check`.

### MINOR: Doctor reports symlink as copy

- Evidence: installer check sees symlink; doctor follows it and reports `copy`.
- Risk: install diagnostics are misleading.
- Suggested fix: use `lstatSync` and print symlink target.
- Verification: installer check and doctor agree on symlink/copy.

### MINOR: Portuguese docs contain stale version examples

- Evidence: PT smoke/architecture docs still show `0.0.1` bridge examples.
- Risk: PT users validate against obsolete output.
- Suggested fix: update examples to `0.1.0` or dynamic placeholders.
- Verification: `rg '0\\.0\\.1|0\\.0\\.19' docs src live` only returns intentional historical/contract references.

## Blocked / Not Run

- `npm publish`, `git push`, GitHub Release create/upload, MCP Registry submit, Smithery/Glama publish, Docker/ghcr push: blocked by publish/write policy.
- Push 2/3 hardware smoke: blocked by missing hardware.
- Real Live mutation smoke: not run in this audit-only pass.
