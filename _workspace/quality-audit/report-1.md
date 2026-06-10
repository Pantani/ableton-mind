# Quality Audit Report 1

**Date:** 2026-06-10
**Mode:** full audit, audit-only first pass

## Executive Summary

**Fix Wave 1 update:** the immediate code issues from the audit have been addressed: runtime version metadata, CLI help/version routing, DXT tool parity, release/prepublish gates, doctor symlink/version detection and the TS complexity gate are now covered by tests and passing locally.

**Live smoke update:** Ableton Live is open and activated. Read-only bridge smoke passed against Live `12.4.1`: `system.hello`, `system.ping`, `track.list`, `session.get_info`, `session.snapshot` and MCP server bootstrap all succeeded with bridge/package `0.1.0`. The Remote Script symlink has been reinstalled to this checkout and `ableton-mind-doctor` is now fully green.

The repo has a strong baseline: typecheck, lint, Vitest, Python bridge tests, docs build, dependency boundaries, package dry-run, MCPB build, Docker build and runtime dependency audit all pass after `npm ci`.

The release should not proceed yet without a final Live reload smoke for the browser handler. The active Live bridge now reports `0.1.0`, and install-target provenance is fixed; however, the currently running Live process still returns `browser.get_categories.available=false` until the Control Surface is reloaded and executes the current checkout code.

Top quality risks:

1. Browser category runtime fix needs a final Control Surface reload smoke.
2. Automation payload validation remains too permissive.
3. Unverifiable operations still overstate verification confidence.
4. Some release/install/Push/recipe tests remain missing.

## Command Gate Status

| Area | Status |
|---|---|
| Node setup | PASS after `npm ci` |
| TypeScript typecheck | PASS |
| Biome lint | PASS |
| Vitest | PASS-WITH-SKIPS, 168 passed / 4 skipped |
| Build | PASS |
| DXT/MCPB | PASS |
| Docs build | PASS |
| Dependency cruiser | PASS |
| TS complexity | PASS |
| Python complexity/lint | PASS |
| Python bridge tests | PASS-WITH-SKIPS, 104 passed / 2 skipped |
| npm pack dry-run | PASS |
| npm publish dry-run | PASS |
| Runtime npm audit | PASS |
| Full npm audit | PASS |
| Docker build | PASS |
| Doctor | PASS |
| Live/Push hardware | BLOCKED / not run for mutation |

## Findings By Severity

### BLOCKER: Live smoke/install target consistency

- Owner: runtime-release-auditor, python-bridge-engineer, distribution-docs-engineer.
- Evidence: package/manifests are `0.1.0`; current read-only smoke reports bridge `0.1.0`; Remote Script symlink now points at `/Users/pantani/.codex/worktrees/4656/ableton-mind/live/AbletonMind`.
- Risk: fixed; doctor now detects and rejects install-target mismatch.
- Suggested fix: complete.
- Verification: `node dist/cli/doctor.js` is fully green.
- Status: fixed in Fix Wave 3.

### MAJOR: `npm run complexity` fails in local LLM/copilot

- Owner: refactor-maintainability-engineer, local-copilot-engineer.
- Evidence: 6 complexity errors in `src/cli/chat.ts`, `src/llm/agent.ts`, `src/llm/client.ts`, `src/llm/server.ts`, `src/llm/tools.ts`.
- Risk: official maintainability gate is red.
- Suggested fix: split high-complexity functions into parsing/routing/SSE/tool-dispatch helpers.
- Verification: `npm run complexity`, `npm test -- tests/llm-local-copilot.test.ts`.
- Status: fixed in Fix Wave 1.

### MAJOR: Runtime version metadata is hard-coded and stale

- Owner: ts-server-engineer, distribution-docs-engineer.
- Evidence: TS startup/handshake report `0.0.x` while package/manifests are `0.1.0`.
- Risk: support, telemetry and release validation see wrong versions.
- Suggested fix: centralize version metadata and test package/runtime parity.
- Verification: startup smoke reports `0.1.0`; distribution validation test covers version parity.
- Status: fixed in Fix Wave 1.

### MAJOR: DXT manifest lists 6 tools while runtime exposes 33

- Owner: distribution-docs-engineer, ts-server-engineer.
- Evidence: `dxt/manifest.json` lists 6 tools; `src/tools/index.ts` registers 33.
- Risk: bundle/listing metadata underrepresents capabilities and can drift.
- Suggested fix: generate tool metadata from registry or remove stale static list if optional.
- Verification: distribution test comparing DXT tools with `allTools`.
- Status: fixed in Fix Wave 1.

### MAJOR: Doctor approves stale/wrong Remote Script target

- Owner: distribution-docs-engineer.
- Evidence: installer check shows symlink to another checkout; doctor reports all green and reports it as copy.
- Risk: developers debug the wrong bridge.
- Suggested fix: use `lstatSync`/`realpathSync`, print target, compare source path and bridge version.
- Verification: doctor warns/fails on wrong symlink or bridge/package mismatch.
- Status: fixed in Fix Wave 1.

### MAJOR: Main binary lacks help/version handling

- Owner: ts-server-engineer, distribution-docs-engineer.
- Evidence: `node dist/index.js --help` starts MCP server and connects Live.
- Risk: first-run help invokes runtime side effects.
- Suggested fix: implement `--help`, `--version` and unknown-subcommand errors before bridge startup.
- Verification: `node dist/index.js --help` exits 0 without bridge connection.
- Status: fixed in Fix Wave 1.

### MAJOR: Unverifiable operations report `verified: true`

- Owner: ts-server-engineer, qa-integration.
- Evidence: `UNVERIFIABLE.ok` maps to `verified: true` in async tools.
- Risk: verify loop overstates confidence.
- Suggested fix: model unverifiable status explicitly.
- Verification: tests for async tools expect `verified: false` or reasoned status.
- Status: open.

### MAJOR: Release workflow misses release gates

- Owner: distribution-docs-engineer.
- Evidence: release workflow omits `test:bridge`, docs build, pack dry-run, MCPB validation and runtime audit before publishing assets.
- Risk: tag release can publish incomplete artifacts.
- Suggested fix: add gates before any GitHub Release/Docker/npm steps.
- Verification: workflow fails before publish/write steps when a gate fails.
- Status: fixed in Fix Wave 1.

### MAJOR: Dev toolchain vulnerabilities

- Owner: distribution-docs-engineer.
- Evidence: `npm audit` fails on dev chain; `npm audit --omit=dev` passes.
- Risk: local dev/docs servers remain vulnerable.
- Suggested fix: upgrade or explicitly waive dev-only advisories with expiry; keep runtime audit hard.
- Verification: `npm audit`, `npm audit --omit=dev`, `npm test`, `npm run docs:build`.
- Status: fixed in Fix Wave 1.

### MAJOR: Remote bridge remote-bind and frame-size safety gaps

- Owner: python-bridge-engineer, ts-server-engineer.
- Evidence: bridge host is configurable and no auth/token is required; NDJSON buffers/queues lack explicit size limits.
- Risk: if exposed remotely, a client can mutate Live or DoS the bridge.
- Suggested fix: loopback-only default with remote opt-in/token; max frame and pending request limits.
- Verification: Python/TS tests for remote bind rejection, token requirement and oversized frames.
- Status: fixed in Fix Wave 2 for loopback default, remote opt-in, max frame and pending request limits. Token auth remains deferred unless remote hosting becomes a supported default path.

### MAJOR: Browser category runtime access fails in Live

- Owner: python-bridge-engineer, usability-flow-auditor.
- Evidence: read-only Live smoke returned `browser.get_categories.available=false` with reason `browser unavailable (headless/no app)` while Live was open.
- Risk: browser discovery and browser-driven loading flows are unavailable even when Live is running.
- Suggested fix: support `ControlSurface.application()` and fallback to `Live.Application.get_application()`.
- Verification: Python regression tests for both access paths; final Live smoke after Control Surface reload should return `available=true`.
- Status: code fixed in Fix Wave 3; final Live smoke pending Control Surface reload.

### MAJOR: Automation payload validation is too permissive

- Owner: python-bridge-engineer.
- Evidence: automation handlers accept float conversions without finite/range/count validation.
- Risk: invalid payloads can corrupt automation or crash handler paths.
- Suggested fix: validate finite numbers, ranges, count limits and curve types.
- Verification: Python invalid-automation tests.
- Status: open.

### MAJOR: Key release/install scripts and Push handler need tests

- Owner: test-coverage-engineer, distribution-docs-engineer, python-bridge-engineer.
- Evidence: doctor CLI, installer, Push Python handler, DXT manifest parity and packaging scripts lack direct behavioral coverage.
- Risk: release-critical behavior can regress silently.
- Suggested fix: add focused Vitest/Python tests.
- Verification: new targeted tests plus existing suites.
- Status: partially covered in Fix Wave 1; installer, Push Python, invalid recipe and packaging edge-case tests remain open.

### MINOR: Docker build is not lockfile-strict

- Owner: distribution-docs-engineer.
- Evidence: Dockerfile uses `npm install` instead of `npm ci`.
- Risk: image dependency drift.
- Suggested fix: switch builder/runtime to `npm ci`.
- Verification: `docker build -t ableton-mind:audit .`.
- Status: open.

### MINOR: Source maps are included despite ignore policy

- Owner: distribution-docs-engineer.
- Evidence: pack includes `dist/*.map`; `.npmignore` suggests maps should be excluded but `files: ["dist"]` includes them.
- Risk: package policy ambiguity and larger package.
- Suggested fix: choose policy and update build/ignore/docs accordingly.
- Verification: `npm pack --dry-run --json`.
- Status: open.

### MINOR: Docs and Remote Script README contain stale claims/examples

- Owner: distribution-docs-engineer.
- Evidence: Remote Script README still references Phase 0; PT docs include old version examples; docs overstate universal tool invariants.
- Risk: users validate against stale output or assume stronger safety guarantees than implemented.
- Suggested fix: update docs to current `0.1.0` behavior and explicit exceptions.
- Verification: `npm run docs:build`, targeted `rg` checks.
- Status: open.

### MINOR: Recipe loader can hide invalid recipes

- Owner: recipe-designer, ts-server-engineer.
- Evidence: loader catches and ignores recipe load errors.
- Risk: bad recipe files disappear silently.
- Suggested fix: fail/warn on invalid recipe JSON except schema file.
- Verification: recipe invalid-fixture test.
- Status: open.

### MINOR: Skipped tests hide known edges

- Owner: qa-integration.
- Evidence: Vitest has 4 skipped tests; Python bridge has 2 skipped tests.
- Risk: skipped error/listener paths can regress.
- Suggested fix: repair fakes and re-enable where practical.
- Verification: `npm test`, `npm run test:bridge` with fewer/no skips.
- Status: open.

## Blocked Checks

- Real Push 2/3 hardware smoke remains blocked by missing hardware.
- Publish/write gates were not run by policy.
- Real Live mutation smoke was not run in this audit-only pass.

## Recommended Fix Order

1. Reload/reactivate AbletonMind Control Surface in Live and repeat read-only browser smoke.
2. Harden automation payload validation with finite/range/count checks.
3. Model unverifiable operations explicitly instead of returning `verified: true`.
4. Add the remaining high-value tests: installer, Push Python, invalid recipe JSON and package-script edge cases.
5. Decide Docker lockfile/source-map/package policy.
6. Update stale Remote Script README and PT docs examples.
7. Re-enable skipped tests where practical.
