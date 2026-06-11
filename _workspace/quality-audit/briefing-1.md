# Quality Audit Briefing 1

**Date:** 2026-06-10
**Mode:** Full audit, audit-only first pass
**Lead:** quality-audit-lead

## User Goal

Start a complete quality audit for ableton-mind: test the real command surface, find security, usability, flow, maintainability and coverage risks, and prepare a prioritized path for fixes and missing tests.

No source/runtime fixes are authorized in this first pass unless a check requires a report-only artifact update. Publish, push, registry, Docker push, real Ableton Live mutation and Push hardware checks are blocked until explicitly confirmed.

## Current Project State

From `_workspace/PROGRESS.md`:

- `v0.1.0` release closure is green and ready for final manual publish gate.
- TD-048 is closed.
- TD-030 remains blocked by missing Push hardware.
- Version sync is expected at `0.1.0` across package, lockfile, DXT manifest, server manifest and safeskill manifest.
- No tag, push, npm publish, GitHub Release, registry submission or Docker/ghcr push has been performed.
- Real Ableton Live smoke passed in Cycle 21, but Push smoke remains hardware-blocked.

Current working tree is intentionally dirty from the newly added quality-audit harness files. Preserve those changes and do not revert unrelated work.

## Command Matrix Sources

- `package.json` scripts and bin entries.
- `.github/workflows/ci.yml`, `.github/workflows/docs.yml`, `.github/workflows/release.yml`.
- `README.md`, `docs/`, `CHANGELOG.md` command snippets.
- `scripts/`, `Dockerfile`, `dxt/manifest.json`, `server.json`, `safeskill.manifest.json`, `smithery.yaml`, `glama.json`.
- Python bridge tests under `live/AbletonMind/tests/`.

## Command Safety Policy

| Class | Default | Examples |
|---|---|---|
| Safe read/check | Run locally | `npm run typecheck`, `npm run lint`, `npm test`, `npm run build`, `npm run docs:build`, `npm run build:dxt:check`, `npm run deps:validate`, `npm run complexity`, `npm run complexity:py`, `npm run lint:py`, `npm run test:bridge`, `npm pack --dry-run --json`, `npm audit --omit=dev`, Docker build |
| Local mutating | Avoid unless needed; prefer check mode/temp copy | `npm run lint:fix`, `npm run format`, `npm run install:remote-script`, `npm run deps:graph`, `npm run version` |
| External read | Run if useful and non-mutating | `npm audit`, read-only `npm view`/`gh` queries |
| Publish/write | Blocked | `npm publish`, `git push`, GitHub Release upload/create, Docker push, registry submit |
| Hardware/live | Blocked until explicit confirmation | Real Ableton Live mutation, Push hardware smoke |

Codex local command execution should use `rtk proxy <command>`; reports should record raw commands that users and CI can copy.

## Track Assignments

| Track | Agent Role | Scope | Output |
|---|---|---|---|
| Commands | command-surface-auditor | Inventory and run safe command matrix; identify stale/broken commands | `command-surface-1.md` |
| Security | security-supply-chain-auditor | Dependencies, scripts, bridge, workflows, Docker, release security | `security-1.md` |
| Usability | usability-flow-auditor | Install, doctor, docs, CLI errors, MCP ergonomics, recipes | `usability-1.md` |
| Coverage | test-coverage-engineer | Untested risky code and command surfaces; proposed regression tests | `test-coverage-1.md` |
| Maintainability | refactor-maintainability-engineer | Complexity, duplication, boundaries, dead code, safe refactor candidates | `maintainability-1.md` |
| Runtime | runtime-release-auditor | Artifact readiness, manifest sync, package contents, DXT/MCPB, Docker/docs/release gates | `runtime-release-1.md` |
| Gate | qa-integration | Final cross-boundary verification if fixes land | Not required in audit-only pass |

## Gate Criteria

The audit pass is complete when:

- Safe command matrix has PASS/FAIL/BLOCKED status with exact commands and evidence.
- Each track has a report under `_workspace/quality-audit/`.
- Consolidated `report-1.md` orders findings by severity.
- `backlog-1.md` separates immediate fixes, later fixes and blocked checks.
- Any command requiring publish, external write, Live mutation or Push hardware is recorded as blocked rather than executed.
