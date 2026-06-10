# Quality Audit Report 1

**Date:** 2026-06-10
**Mode:** full audit, audit-only first pass

## Executive Summary

**Fix Wave 1 update:** the immediate code issues from the audit have been addressed: runtime version metadata, CLI help/version routing, DXT tool parity, release/prepublish gates, doctor symlink/version detection and the TS complexity gate are now covered by tests and passing locally. The remaining blocker is operational: the installed Ableton Remote Script still points at another checkout and the running bridge reports `0.0.21` while this checkout/package is `0.1.0`.

The repo has a strong baseline: typecheck, lint, Vitest, Python bridge tests, docs build, dependency boundaries, package dry-run, MCPB build, Docker build and runtime dependency audit all pass after `npm ci`.

The release should not proceed yet without an explicit waiver or fix for the stale Live bridge/Remote Script mismatch. The current smoke connects to a bridge reporting `0.0.21` from another checkout, while this release candidate is `0.1.0`.

Top quality risks:

1. Stale Remote Script/bridge invalidates local Live smoke for this checkout until reinstall/reload.
2. Automation payload validation remains too permissive.
3. Unverifiable operations still overstate verification confidence.
4. Some release/install/Push/recipe tests remain missing.

## Command Gate Status

| Area | Status |
|---|---|
| Node setup | PASS after `npm ci` |
| TypeScript typecheck | PASS |
| Biome lint | PASS |
| Vitest | PASS-WITH-SKIPS, 166 passed / 4 skipped |
| Build | PASS |
| DXT/MCPB | PASS |
| Docs build | PASS |
| Dependency cruiser | PASS |
| TS complexity | PASS |
| Python complexity/lint | PASS |
| Python bridge tests | PASS-WITH-SKIPS, 101 passed / 2 skipped |
| npm pack dry-run | PASS |
| npm publish dry-run | PASS |
| Runtime npm audit | PASS |
| Full npm audit | PASS |
| Docker build | PASS |
| Doctor | FAILS CORRECTLY on stale target/version mismatch |
| Live/Push hardware | BLOCKED / not run for mutation |

## Findings By Severity

### BLOCKER: Live smoke does not prove this checkout/release

- Owner: runtime-release-auditor, python-bridge-engineer, distribution-docs-engineer.
- Evidence: package/manifests are `0.1.0`; `node dist/index.js` handshake reports bridge version `0.0.21`; `install-remote-script --check` points installed Remote Script at `/Users/pantani/Desktop/projects/art/ableton-mind/live/AbletonMind`, not this worktree.
- Risk: release can be approved with Live running a stale bridge from another checkout.
- Suggested fix: reinstall/reactivate Remote Script from the current checkout, restart Live, and make doctor compare bridge version/path against current package/source.
- Verification: `node dist/index.js` logs bridge version `0.1.0`; `node dist/cli/doctor.js` warns/fails on mismatch.
- Status: code fixed; operationally blocked until current Remote Script is installed/reactivated and Live smoke is rerun.

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

1. Fix doctor/path/version detection and reinstall/re-smoke the current bridge.
2. Centralize runtime version metadata.
3. Add help/version handling for the main binary.
4. Fix DXT manifest parity test/generation.
5. Add release workflow gates.
6. Resolve complexity failures in local-copilot.
7. Add high-value missing tests: doctor CLI, installer, Push Python, recipes invalid JSON, package scripts.
8. Harden bridge remote bind/frame limits and automation validation.
