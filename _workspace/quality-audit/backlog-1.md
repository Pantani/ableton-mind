# Quality Audit Backlog 1

**Date:** 2026-06-10

## Immediate Fixes

1. **BLOCKER - Current Live smoke points at stale bridge** — CODE FIXED / OPERATIONAL BLOCKED
   - Fixed: doctor now detects wrong Remote Script symlink target and bridge/package version mismatch.
   - Still blocked: installed Remote Script currently points at `/Users/pantani/Desktop/projects/art/ableton-mind/live/AbletonMind`; running bridge reports `0.0.21` while this checkout is `0.1.0`.
   - Verify after reinstall/reactivation: `node dist/cli/doctor.js`, `node dist/index.js` handshake shows bridge version `0.1.0`.

2. **MAJOR - Runtime TS versions stale** — DONE
   - Fix: centralize version metadata used by startup log, MCP server metadata and handshake.
   - Verify: distribution version test, `node dist/index.js --version`.

3. **MAJOR - Main binary help/version** — DONE
   - Fix: implement `--help`, `--version` and unknown subcommand guard before bridge startup.
   - Verify: `node dist/index.js --help` exits 0 without bridge connection.

4. **MAJOR - DXT manifest tool drift** — DONE
   - Fix: DXT manifest now lists all runtime tools and distribution validation compares it to `allTools`.
   - Verify: `npm test -- tests/distribution-validation.test.ts`.

5. **MAJOR - Release workflow gate gap** — DONE
   - Fix: add `test:bridge`, docs build, pack dry-run, MCPB validation and runtime audit before release upload/push/publish.
   - Verify: workflow/static check and local command matrix.

## Next Fix Wave

1. **MAJOR - `npm run complexity` fails** — DONE
   - Scope: local-copilot/LLM refactor.
   - Verify: `npm run complexity`, `npm test -- tests/llm-local-copilot.test.ts`.

2. **MAJOR - Dev dependency vulnerabilities** — DONE
   - Fix: upgraded Vitest to 4.1.8 and pinned safe Vite/Vue plugin overrides compatible with VitePress 1.6.4.
   - Verify: `npm audit`, `npm test`, `npm run docs:build`.

3. **MAJOR - Bridge remote bind/frame limits** — DONE
   - Fix: bridge rejects non-loopback binds by default, supports explicit `allow_remote` / `ABLETON_MIND_ALLOW_REMOTE=1`, caps incoming frames, and TS client caps incoming frames plus pending requests.
   - Verify: bridge/live-client tests.

4. **MAJOR - Automation validation**
   - Scope: finite/range/count validation for automation payloads.
   - Verify: Python invalid automation tests.

5. **MAJOR - Missing high-value tests** — PARTIAL
   - Scope: doctor CLI, installer, Push Python handler, DXT manifest parity, recipe invalid JSON, packaging scripts.
   - Done: entrypoint CLI routing, doctor symlink/version core, DXT tool parity, release/prepublish gate static checks.
   - Verify: targeted Vitest/Python tests plus existing suites.

## Later Fixes

- Switch Dockerfile to `npm ci` / `npm ci --omit=dev`.
- Decide source map package policy.
- Mark installer bin executable or test npm shim behavior.
- Update stale Remote Script README and PT docs version examples.
- Document tool invariant exceptions and `track_upsert` safe path.
- Re-enable skipped tests where practical.
- Add TS/Python/recipe parity script.
- Pin `uvx ruff` version.
- Add Dependabot/security automation.

## Blocked / Requires Confirmation

- Push 2/3 hardware smoke: blocked by physical hardware availability.
- Real Live mutation smoke: requires explicit user confirmation and current Remote Script installation.
- npm publish, GitHub Release, registry submission, Docker/ghcr push, git push: requires explicit publish/write confirmation.
