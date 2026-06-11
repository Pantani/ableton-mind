# Command Surface Audit 1

**Date:** 2026-06-10
**Mode:** full audit, safe/local commands only

## Summary

The normal Node, Python, docs, package, DXT/MCPB and Docker checks mostly pass after `npm ci`. The main command failure is the official maintainability gate `npm run complexity`, which fails on 6 local-copilot/LLM hotspots. The first `npm run typecheck` failed before dependencies were installed; after `npm ci`, it passed.

Publish/write and hardware commands were not run.

## Command Matrix

| Command | Source | Class | Status | Evidence |
|---|---|---|---|---|
| `npm run typecheck` | `package.json` | safe check | PASS after setup | First run failed with `tsc: command not found`; after `npm ci`, `tsc --noEmit` passed. |
| `npm ci` | CI/workflows | local install | PASS-WITH-WARNINGS | Installed 421 packages; npm reported 6 dev vulnerabilities and pending install-script approvals. |
| `npm run lint` | `package.json`, CI | safe check | PASS | Biome checked 119 files with no fixes. |
| `npm test` | `package.json`, CI | safe check | PASS-WITH-WARNINGS | Vitest: 15 files passed, 154 passed, 4 skipped. Notification/bridge warning logs appeared in expected tests. |
| `npm run build` | `package.json`, CI/docs | local build | PASS | tsup built `dist/index.js` and `dist/cli/doctor.js`; assets copied. |
| `npm run build:dxt:check` | `package.json`, CI | safe check | PASS | DXT prerequisites OK. |
| `npm run build:mcpb` | `package.json`, docs | local artifact | PASS | Built `build/ableton-mind-0.1.0.mcpb`, 166 entries, 307.4 KB. |
| `npm run docs:build` | docs workflow | local build | PASS | VitePress build completed. |
| `npm run deps:validate` | `package.json` | safe check | PASS | dependency-cruiser: 68 modules, 132 deps, no violations. |
| `npm run complexity` | `package.json` | safe check | FAIL | 6 complexity errors in `src/cli/chat.ts`, `src/llm/agent.ts`, `src/llm/client.ts`, `src/llm/server.ts`, `src/llm/tools.ts`. |
| `npm run complexity:all` | `package.json` | metric | PASS-WITH-WARNINGS | Exit 0 with 177 warnings at threshold 1. |
| `npm run complexity:py` | `package.json` | safe check | PASS | Ruff C901 produced no failures. |
| `npm run lint:py` | `package.json` | safe check | PASS | `uvx ruff check live/AbletonMind`: all checks passed. |
| `npm run test:bridge` | `package.json` | safe check | PASS-WITH-SKIPS | Python unittest: 101 tests OK, 2 skipped. |
| `npm pack --dry-run --json` | docs/release | package dry-run | PASS | Tarball has 181 entries, 233016 bytes, includes dist, recipes, Remote Script, manifests and installer. |
| `npm publish --dry-run --access public` | docs/release | publish dry-run | PASS | Ran prepublishOnly gates and reported dry-run publish only. |
| `npm audit --omit=dev` | audit | external read | PASS | 0 runtime vulnerabilities. |
| `npm audit` | audit | external read | FAIL | 6 dev vulnerabilities through `vitest`/`vite`/`vitepress`/`esbuild`. |
| `docker build -t ableton-mind:audit .` | docs/CI | local Docker build | PASS | Built image successfully. |
| `node dist/cli/doctor.js` | bin smoke | safe runtime check | PASS-WITH-WARNING | Reported all green, but Remote Script is linked to another checkout and bridge version is stale. |
| `node scripts/install-remote-script.mjs --check` | docs/install | safe check | PASS-WITH-WARNING | Target is symlink to `/Users/pantani/Desktop/projects/art/ableton-mind/live/AbletonMind`, not this worktree. |
| `node scripts/extract-device-schemas.mjs --inventory` | package script | safe read | PASS-BLOCKED-DATA | No `.adv` files found in Ableton Defaults folder. |
| `node scripts/extract-device-schemas.mjs --dry-run` | package script | safe read | PASS-BLOCKED-DATA | Same: no `.adv` files found. |
| `node dist/index.js </dev/null` | bin smoke | runtime smoke | PASS-WITH-WARNING | Server starts, connects bridge, registers 33 tools, 5 prompts, 3 resources; bridge reports stale `0.0.21`. |

## Not Run

| Command | Reason |
|---|---|
| `npm run lint:fix`, `npm run format` | Mutating formatting commands. |
| `npm run install:remote-script` | Mutates Ableton User Library. |
| `npm run deps:graph` | Mutates generated docs artifact. |
| `npm run version` | Mutates manifests and stages files. |
| `npm publish`, `git push`, GitHub Release upload/create, Docker push, registry submissions | Publish/write gates require explicit user confirmation. |
| Real Live mutation smoke and Push hardware smoke | Requires explicit Live/Push confirmation; Push hardware remains blocked. |

## Command Findings

### MAJOR: `npm run complexity` is red

- Evidence: `npm run complexity` fails on 6 functions: `src/cli/chat.ts:219`, `src/cli/chat.ts:298`, `src/llm/agent.ts:64`, `src/llm/client.ts:78`, `src/llm/server.ts:169`, `src/llm/tools.ts:342`.
- Risk: official quality gate cannot be used as a release confidence gate.
- Verification after fix: `npm run complexity`, `npm test -- tests/llm-local-copilot.test.ts`, `npm run typecheck`, `npm run lint`.

### MAJOR: Local runtime smoke is not proving this worktree

- Evidence: `node dist/index.js` connects successfully but handshake returns bridge version `0.0.21`; `install-remote-script --check` points the installed Remote Script at another checkout.
- Risk: local tests can pass against a bridge different from the current release candidate.
- Verification after fix: reinstall/restart Live from this checkout, then `node dist/index.js` should report bridge version `0.1.0`.

### MINOR: Dev dependency audit is red while runtime audit is clean

- Evidence: `npm audit --omit=dev` passes; `npm audit` reports 6 dev vulnerabilities through Vite/Vitest/VitePress/esbuild.
- Risk: dev/docs servers remain a local security surface.
- Verification after fix or waiver: `npm audit`, `npm test`, `npm run docs:build`.
