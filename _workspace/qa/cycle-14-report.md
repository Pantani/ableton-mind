# QA Report — Cycle 14 (Release Candidate prep)

**Date:** 2026-06-09
**Verdict:** **PASS-WITH-WARNINGS**

## Summary

TD-038/039/040 closed. Knowledge reaches **40/50 = 80%** PLAN.md §5. Recipes 10. Doctor CLI gets a 6th check (version sync). Version bumped to 0.0.14.

**Blocker for tag v0.1.0-rc.1: TD-004 (real smoke) — depends on user.**

## Tech debt

| ID | Status |
|---|---|
| TD-004 | 🟡 PENDING (user) — BLOCKS rc.1 |
| TD-005 | 🟡 PENDING (sandbox) |
| TD-030 | 🟡 PENDING (Push hardware) |
| TD-038 (workflow tests) | ✅ CLOSED — `tests/distribution-validation.test.ts` (14+ cases) |
| TD-039 (version sync) | ✅ CLOSED — `checkVersionSync()` in Doctor CLI |
| TD-040 (CI secrets) | ✅ CLOSED — `docs/distribution.md` §5b |

**3 closed. Open: TD-004/005/030 (all real-environment).**

## Doctor CLI — 6 checks

1. Node.js >= 20
2. Remote Script installed
3. Bridge on :9876
4. Valid knowledge base
5. Valid recipes
6. **Version sync (pkg ↔ DXT)** ← NEW Cycle 14

In an environment installed via npm without `dxt/manifest.json` packaged, the check is `ok: true` with detail "skip" (graceful).

## Distribution validation — TD-038

`tests/distribution-validation.test.ts` covers:
- **Version sync:** `package.json::version === dxt/manifest.json::version` + SemVer regex.
- **CHANGELOG:** exists, starts with `# Changelog`, has Unreleased section, mentions current version.
- **GitHub workflows:** ci.yml + release.yml parseable, reference npm/python/docker, correct OIDC permissions.
- **Dockerfile:** multi-stage Node 20 + CMD pointing to dist/.
- **smithery.yaml:** commandFunction + configSchema + ABLETON_MIND_HOST present.
- **.npmignore:** excludes src/live/tests, but keeps recipes/ (not in ignore).
- **README + docs:** README.md + docs/distribution.md + docs/smoke-test.md exist, with localized pages under docs/pt.

14 assertions/it blocks.

## Knowledge — 40 devices (80% PLAN.md §5)

New Cycle 14: Drum Buss (drum bus all-in-one) + Redux (bit crusher).

## Recipes — 10

New: `chords/lofi-jazz` — Operator (Rhodes) + Redux + Vinyl Distortion + Cmaj7→Am7→Fmaj7→G7 progression.

## Version: 0.0.14

`package.json` + `dxt/manifest.json` + CHANGELOG sync.

## Total MCP tools: 31 (unchanged)

## Warnings

### W1 — TD-004 still blocks rc.1
Without real smoke, it is not responsible to tag `v0.1.0-rc.1`. Pre-1.0 cycles can continue adding devices/recipes but the official release needs validation against Live.

### W2 — distribution-validation tests depend on cwd
Tests resolve `REPO_ROOT` via `import.meta.url`. Work in any cwd. ✓

### W3 — Drum Buss and Redux have params with ambiguous unit
Some Drive params are `0..1 linear` in the UI but map to a curve in the engine. Knowledge documents the raw value — the LLM needs to understand that 0.5 != audible half. General documentation. Does not block. TD-041 (low).

### W4 — CI workflow only runs on PR/push
Does not run on release tag commits. But `release.yml` re-runs the checks. OK.

## Recommendation

**PASS Cycle 14.** System ready for release. When TD-004 PASS:

```bash
git checkout -b release/0.1.0-rc.1
# bump package.json + dxt/manifest.json to 0.1.0-rc.1
# update CHANGELOG
git commit -m "release: v0.1.0-rc.1"
git tag v0.1.0-rc.1
git push origin v0.1.0-rc.1
```

Release workflow triggers automatically.

## Next — Cycle 15

- **TD-004 smoke** (blocker).
- Tag `v0.1.0-rc.1` (after smoke PASS).
- TD-041 ambiguous docs.
- +5 devices (Spectral Blur, Drift Engine, Resonator, Beat Repeat, External Audio Effect) → target 45 total.
- +2 recipes.
