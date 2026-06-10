# ADR 0009 — Release versioning + branching

**Date:** 2026-06-09
**Status:** Accepted
**Author:** architect

## Context

Phase 7 enters finalization. A version policy is required before the first public release (`v0.1.0` planned for Cycle 14 after the real smoke).

## Decision

### Strict SemVer

`MAJOR.MINOR.PATCH`:
- **MAJOR:** breaking change in any MCP tool (input/output shape, naming, behavior), in the bridge protocol (envelope, error codes, method naming), or in the recipe format.
- **MINOR:** new tools, new devices in the knowledge, new recipes, new notifications, new handlers in the bridge without changing existing ones.
- **PATCH:** bug fixes, performance, docs, internal refactor without API change.

Pre-1.0: MINOR may break (flagged in CHANGELOG). Post-1.0: strict.

### Branching

- `main` — always publishable.
- `feat/*` — work in progress, squash-merge into main.
- `release/X.Y.Z` — frozen for tag + release.

Tags: `vX.Y.Z` (with `v` prefix).

### Release flow

1. `CHANGELOG.md` updated with the version.
2. Bump `package.json` version + `dxt/manifest.json` version (must match — Doctor CLI checks).
3. PR `release/X.Y.Z` → merge.
4. `git tag vX.Y.Z` + push.
5. GitHub Action `release.yml` running:
   - npm publish (after pre-1.0)
   - build:dxt → upload artifact + release attachment
   - smithery sync
   - docker build + push to `ghcr.io/Pantani/ableton-mind:vX.Y.Z` and `:latest`

### Pre-releases

Tags with `-rc.N` or `-beta.N` for release candidates (`v0.1.0-rc.1`).

### Planned timeline

- `v0.0.x` — Cycles 1-13 (current state). Unstable API.
- `v0.1.0-rc.1` — Cycle 14 after real smoke. Release candidate.
- `v0.1.0` — Cycle 15 after validation.
- `v1.0.0` — Phase 8 (long tail) cleaned + 50+ devices + 20+ recipes + green smoke CI on macOS+Windows.

### Live compatibility

Each release declares `live_compat: ["12.x", "11.x"]` in the README. Tools that depend on a Live-12-only feature flagged individually (already seen in `bass.json`, `drift.json`, `shifter.json`, etc).

## Consequences

- `package.json::version` and `dxt/manifest.json::version` must match. Doctor CLI gets a check (TD-038 low).
- CI/release workflow versioned.
- CHANGELOG mandatory in PR (linted via GitHub Action) — Cycle 14+.

## How to apply

- Cycle 13: establishes `CHANGELOG.md`, GitHub Actions, ADR.
- Cycle 14: real smoke → tag `v0.1.0-rc.1`.
