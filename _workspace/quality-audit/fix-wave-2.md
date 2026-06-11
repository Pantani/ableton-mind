# Quality Audit Fix Wave 2

**Date:** 2026-06-10

## Closed

- Hardened Python Remote Script bridge binding: non-loopback hosts are rejected by default.
- Added explicit remote opt-in with `allow_remote=True` and `ABLETON_MIND_ALLOW_REMOTE=1`.
- Added Python bridge max-frame handling for oversized NDJSON JSON-RPC requests.
- Added TS client max incoming frame handling and max pending JSON-RPC request handling.
- Avoided unhandled `error` EventEmitter crashes when callers do not register an error listener.
- Documented loopback-only default and remote opt-in in README, Remote Script README and EN/PT distribution docs.
- Marked TD-048 package validation debt closed after full local gate recovery.

## Evidence

- RED first:
  - `npm test -- tests/live-client.test.ts` failed on pending/frame-limit expectations.
  - `python3 -m unittest live.AbletonMind.tests.test_bridge -v` failed on missing `max_frame_bytes`, missing `allow_remote`, and remote bind acceptance.
- GREEN:
  - `npm test -- tests/live-client.test.ts` — PASS, 6 passed / 1 skipped.
  - `python3 -m unittest live.AbletonMind.tests.test_bridge -v` — PASS, 13 passed.
  - `npm run typecheck` — PASS.
  - `npm run lint` — PASS.
  - `npm run complexity` — PASS.
  - `npm run lint:py` — PASS.
  - `npm run complexity:py` — PASS.
  - `npm test` — PASS, 168 passed / 4 skipped.
  - `npm run test:bridge` — PASS, 104 passed / 2 skipped.
  - `npm run build` — PASS.
  - `npm run docs:build` — PASS.
  - `npm run build:dxt:check` — PASS.
  - `npm audit` — PASS, 0 vulnerabilities.
  - `npm pack --dry-run --json` — PASS, 181 entries.
  - `git diff --check` — PASS.
- `node dist/cli/doctor.js` still fails correctly on this machine because the installed Remote Script points at another checkout and the running bridge reports `0.0.21` while package is `0.1.0`.

## Still Open

- Operational blocker: reinstall/reactivate the current checkout's Remote Script and rerun Live smoke.
- Automation payload validation: finite/range/count checks.
- Verification semantics: async/unverifiable operations still need an explicit non-verified status model.
- Remaining high-value tests: installer behavior, Push Python handler, invalid recipe loading, packaging script edge cases.
