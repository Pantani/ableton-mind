# Release 0.1.0 Knowledge + Recipes Validation

Date: 2026-06-10

## Scope

Validation track for embedded knowledge and recipe loading under the v0.1.0 package/distribution layout.

Owned production paths:

- `src/knowledge/**`
- `recipes/**`

No devices or recipes were added.

## Commands

- `npm test -- tests/phase5-6-recipes.test.ts tests/resources.test.ts`
  - PASS: 2 files, 29 tests.
- `npm run build`
  - PASS: `tsup` built `dist/index.js` and `dist/cli/doctor.js`; `scripts/copy-assets.mjs` copied `src/knowledge/devices` to `dist/devices`, `src/knowledge/scales.json` to `dist/scales.json`, and `recipes` to `dist/recipes`.
- `node dist/cli/doctor.js`
  - Initial result: BLOCKED for knowledge loading only. `dist/cli/doctor.js` looked for `dist/cli/devices/wavetable.json`; recipes loaded 14 recipes.
  - After fix: PASS. Knowledge base loaded 55 devices; recipes loaded 14 recipes.
- `npm pack --dry-run --json`
  - PASS for this track's package assets. Tarball reported `ableton-mind@0.1.0` with 181 entries and included `dist/devices/**`, `dist/scales.json`, `dist/recipes/**`, root `recipes/**`, and `src/knowledge/**`.
- `npm run typecheck`
  - PASS.
- `npx biome check src/knowledge/index.ts src/recipes/index.ts tests/phase5-6-recipes.test.ts tests/resources.test.ts`
  - PASS: checked 4 files, no fixes applied.

## Findings

- Source-level knowledge and recipe tests already passed.
- Distribution layout exposed one knowledge path bug in the compiled CLI bundle:
  - `src/knowledge/index.ts` used `dirname(import.meta.url)` as the asset root.
  - That works in `src/knowledge/index.ts` and in `dist/index.js`.
  - It fails when bundled into `dist/cli/doctor.js`, because runtime assets are copied to `dist/devices` and `dist/scales.json`, not `dist/cli/devices`.
- Recipe loading remained valid in the compiled doctor path and package dry-run.

## Changed Files

- `src/knowledge/index.ts`
  - Added a minimal asset-root resolver that probes the current module directory and its parent for `devices/` plus `scales.json`.
  - This preserves the dev/server paths and fixes the compiled CLI path.
- `_workspace/release-0.1.0-knowledge-recipes-summary.md`
  - This validation summary.

No recipe files changed.

## Blockers

- No knowledge/recipe blocker remains after the loader fix.
- Out-of-scope observation: the compiled doctor currently reports `Version sync (pkg ↔ DXT)` as `skip (package.json not found)` while still returning OK. This is not caused by knowledge/recipe loading and was not changed by this track.

## Concurrent State

`git status` showed uncommitted changes outside this track in package/manifests and Python tests. They were not touched by this validation pass.
