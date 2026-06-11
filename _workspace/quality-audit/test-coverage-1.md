# Test Coverage Audit 1

**Date:** 2026-06-10
**Mode:** read-only audit

## Summary

Current coverage is strong for core TS tools, prompts/resources, recipes runner smoke, live-client and Python transport/track/clip/session/browser/device handlers. Gaps remain around CLI bins, installer mutating behavior, DXT manifest parity, Push Python handler, packaging scripts, recipe invalid-file behavior and local-copilot HTTP/loopback routes.

## Findings

### MAJOR: Doctor CLI lacks direct exit-code/diagnostic tests

- Evidence: `package.json` exposes `ableton-mind-doctor`; `src/cli/doctor.ts` owns user-facing install/runtime diagnosis.
- Risk: false positives such as stale Remote Script symlink can ship.
- Recommended test: Vitest spawning `dist/cli/doctor.js` or testing extracted checks with temp HOME, fake bridge port, success/failure cases and version mismatch.
- Verification: `npm test -- tests/doctor-cli.test.ts`.

### MAJOR: DXT manifest is not checked against `allTools`

- Evidence: `dxt/manifest.json` lists 6 tools; `src/tools/index.ts` registers 33.
- Risk: bundle metadata drifts silently.
- Recommended test: compare `dxt/manifest.json.tools[].name` with `allTools.map(t => t.name)`, or assert an explicit documented subset.
- Verification: `npm test -- tests/distribution-validation.test.ts`.

### MAJOR: Remote Script installer has no temp-dir behavioral tests

- Evidence: `scripts/install-remote-script.mjs` mutates symlink/copy targets and shells out for copy mode.
- Risk: install script can overwrite or misreport wrong path.
- Recommended test: temp HOME coverage for `--check`, existing target without `--force`, `--copy --force`, symlink target, unsupported platform where feasible.
- Verification: `npm test -- tests/install-remote-script.test.ts`.

### MAJOR: Python Push handler lacks direct tests

- Evidence: TS wrapper has Push coverage; `live/AbletonMind/handlers/push.py` needs direct fake-control-surface tests.
- Risk: Sysex/range/mode behavior can break without hardware or CI signal.
- Recommended test: `test_handlers_push.py` with fake `application.control_surfaces` and `_send_midi`.
- Verification: `python3 -m unittest live.AbletonMind.tests.test_handlers_push -v`.

### MAJOR: Invalid recipes can be ignored silently

- Evidence: recipe loader catches errors and tests only require a lower-bound count.
- Risk: bad recipe files disappear from the index.
- Recommended test: enumerate `recipes/**/*.json` except schema, require expected 14 recipes/7 categories, validate id/path and fail invalid JSON visibly.
- Verification: `npm test -- tests/phase5-6-recipes.test.ts`.

### MAJOR: Packaging/release scripts have mostly structural coverage

- Evidence: `scripts/build-dxt.mjs`, `copy-assets.mjs`, `sync-manifest-version.mjs` are exercised indirectly.
- Risk: bundle missing assets, invalid zip, or manifest drift can slip.
- Recommended test: temp-dir smoke for copy/sync scripts and `build-dxt --out <tmp>` with entry inspection.
- Verification: `npm run build && npm test -- tests/distribution-validation.test.ts`.

### MINOR: Local-copilot HTTP server route/loopback tests are thin

- Evidence: `src/llm/server.ts` contains loopback, settings, tier and SSE behavior; current tests focus mainly on helper behavior.
- Risk: route, CORS/loopback or tier-lock regressions.
- Recommended test: start server on a free port with fake LLM endpoint; cover 403, health, settings, locked tier and 404.
- Verification: `npm test -- tests/llm-local-copilot.test.ts`.

### MINOR: Bridge main-thread/lifecycle paths need more tests

- Evidence: bridge scheduling and Remote Script disconnect are critical but only partly pinned.
- Risk: LiveAPI work can drift off main thread or listeners/sockets can survive disconnect.
- Recommended test: fake controller `schedule_message` queue drain, timeout, disconnect listener teardown and bridge stop.
- Verification: `python3 -m unittest live.AbletonMind.tests.test_bridge_main_thread -v`.

### MINOR: Docs command snippets are not linted

- Evidence: docs include many `npm run`, `node scripts`, Docker and install snippets.
- Risk: docs can reference stale commands without failing `docs:build`.
- Recommended test: extract snippets and validate package scripts / script file existence; check EN/PT tool names.
- Verification: `npm test -- tests/distribution-validation.test.ts -t docs`.
