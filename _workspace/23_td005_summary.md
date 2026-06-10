# Cycle 23 TD-005 Summary

**Owner:** distribution-docs-engineer  
**Debt:** TD-005 - npm install did not run in sandbox  
**Checked:** 2026-06-10T02:22:05Z  
**Verdict:** PASS-WITH-WARNINGS for the npm install environment; BLOCKED for full npm/package validation.

## Evidence

| Command | Location | Outcome |
|---|---|---|
| `rtk npm --version` | repo | PASS - npm `11.16.0` |
| `rtk node --version` | repo | PASS - Node `v26.3.0`, satisfies package engine `>=20` |
| `rtk npm ci --dry-run` | repo | PASS - lockfile/install plan is coherent; warnings for pending `allow-scripts` review |
| `rtk npm run typecheck` | repo | FAIL - TypeScript errors in current source/tests, including `src/index.ts` missing `allResources`, strict optionality errors, and registry generic type errors |
| `rtk npm run lint` | repo | PASS - exit 0; 3 Biome warnings for `console.log` in `src/cli/doctor.ts` |
| `rtk npm test` | repo | FAIL - 140 passed, 4 failed, 3 skipped across 14 files; failures in transport shape expectations, allTools registry count, and JSON-RPC remote error mapping |
| `rtk npm ci` | `/tmp/ableton-mind-td005.At6xpH/repo` clean copy | PASS - installed 421 packages and audited 422 packages in about 2s; reported 6 audit vulnerabilities and pending `allow-scripts` review |
| `rtk npm run build` | temp clean copy | FAIL - tsup/DTS failed; `src/index.ts` cannot find `allResources`, and generated `dist/index.js` showed a duplicate shebang parse error before DTS failure |
| `rtk npm run build:dxt:check` | temp clean copy | FAIL - `dist/index.js` missing because build failed |

## Notes

- I used a temporary clean copy for write-producing checks so this cycle did not create `dist/` or `build/` in the dirty repo worktree.
- I did not run `npm pack --dry-run` because the package build failed and the DXT prerequisite check had no valid `dist/index.js`; a pack dry run after that would not validate a releasable package artifact.
- Existing repo state was already dirty before this work, including `package.json` and many source/docs files. I did not modify package metadata or production paths.

## Closure Recommendation

TD-005's original environment concern is no longer reproduced: `npm ci` works on this real machine in a clean temp copy. However, the Cycle 23 gate says TD-005 can close only with successful npm/package validation, and the current package validation is not green because typecheck, tests, build, and DXT check fail.

Recommendation: keep TD-005 open under the strict Cycle 23 gate, or split it by closing the install-environment portion and opening separate code/package-validation debts for the current TypeScript/test/build failures.
