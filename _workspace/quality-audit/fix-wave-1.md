# Quality Audit Fix Wave 1

**Date:** 2026-06-10

## Closed

- Centralized runtime/package version metadata for startup log, MCP metadata and TS bridge handshake.
- Added `ableton-mind --help`, `--version` and unknown-command handling before bridge startup.
- Added regression tests for entrypoint routing, doctor symlink/version checks, runtime version parity, DXT tool parity, release gates and prepublish gates.
- Expanded `dxt/manifest.json` from 6 tools to the full 33-tool runtime registry.
- Hardened `ableton-mind-doctor` so it fails on wrong Remote Script symlink target and bridge/package version mismatch.
- Added release workflow gates before publish/upload/push steps: bridge tests, docs build, runtime audit, pack dry-run and MCPB manifest validation.
- Expanded `prepublishOnly` to include bridge/docs/DXT/runtime audit gates.
- Refactored local copilot/LLM code to make `npm run complexity` pass.
- Resolved dev dependency audit by upgrading Vitest to 4.1.8 and adding Vite 7 / plugin-vue 6 overrides that keep VitePress 1.6.4 docs building cleanly.

## Evidence

- `npm run typecheck` — PASS.
- `npm run lint` — PASS.
- `npm run complexity` — PASS.
- `npm test` — PASS, 166 passed / 4 skipped.
- `npm run deps:validate` — PASS.
- `npm run build` — PASS.
- `npm run complexity:py` — PASS.
- `npm run lint:py` — PASS.
- `npm run test:bridge` — PASS, 101 passed / 2 skipped.
- `npm run build:dxt:check` — PASS.
- `npm run docs:build` — PASS.
- `npm audit --omit=dev` — PASS, 0 vulnerabilities.
- `npm audit` — PASS, 0 vulnerabilities.
- `npm pack --dry-run --json` — PASS, 181 entries.
- `node dist/index.js --help` — PASS, exits without bridge startup.
- `node dist/index.js --version` — PASS, prints `0.1.0`.
- `node dist/cli/doctor.js` — FAILS CORRECTLY on this machine because the installed Remote Script points at another checkout and the running bridge reports `0.0.21` while package is `0.1.0`.

## Still Open

- Operational blocker: reinstall/reactivate the current checkout's Remote Script and re-run Live smoke.
- Bridge hardening: loopback/remote opt-in/token, max frame size and pending limits.
- Automation payload validation: finite/range/count checks.
- Remaining high-value tests: installer behavior, Push Python handler, invalid recipe loading, packaging script edge cases.
- Verification semantics: async/unverifiable operations still need an explicit non-verified status model.
