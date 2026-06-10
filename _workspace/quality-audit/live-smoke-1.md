# Live Smoke 1

**Date:** 2026-06-10
**Mode:** read-only live runtime smoke

## Context

User confirmed Ableton Live is open and AbletonMind is activated. Mutating tools were not executed.

## Evidence

- `node scripts/install-remote-script.mjs --check`
  - Source: `/Users/pantani/.codex/worktrees/4656/ableton-mind/live/AbletonMind`
  - Target: `/Users/pantani/Music/Ableton/User Library/Remote Scripts/AbletonMind`
  - Current status: symlink to `/Users/pantani/Desktop/projects/art/ableton-mind/live/AbletonMind`
- `node dist/cli/doctor.js`
  - PASS: Node, bridge reachability, bridge version, knowledge, recipes, version sync, MCP primitives.
  - FAIL: Remote Script install target points at another checkout.
- `lsof -nP -iTCP:9876 -sTCP:LISTEN`
  - Live is listening on `127.0.0.1:9876`.
- Direct read-only JSON-RPC smoke:
  - `system.hello`: bridge `ableton-mind/python`, version `0.1.0`, Live `12.4.1`, Python `3.11.6`, protocol `0.1`.
  - `system.ping`: `pong=true`.
  - `track.list`: total `7`, regular `4`, returns `2`, master present.
  - `session.get_info`: tempo `120`, playing `false`, tracks `4`, returns `2`, master present.
  - `session.snapshot`: total tracks `4`.
  - `browser.get_categories`: `available=false`, reason `browser unavailable (headless/no app)`.
- MCP server bootstrap smoke:
  - Startup version `0.1.0`.
  - Handshake OK with bridge `0.1.0`, Live `12.4.1`, Python `3.11.6`.
  - Registered `33` tools, `5` prompts and `3` resources.

## Result

Read-only Live smoke passed. The previous stale-bridge version mismatch is resolved in the active Live process.

## Still Open

- Browser runtime access: code fixed locally, but `browser.get_categories` still returns unavailable in the currently loaded Live process until AbletonMind Control Surface is reloaded.
- Mutation smoke was not run; it requires explicit permission because it can alter the open Live set.

## Fix Wave 3 Retest

- `node scripts/install-remote-script.mjs --force`
  - Repointed installed Remote Script symlink to `/Users/pantani/.codex/worktrees/4656/ableton-mind/live/AbletonMind`.
- `node dist/cli/doctor.js`
  - PASS: all checks green, including install-target consistency and bridge/package version.
- Local browser regression tests:
  - Added coverage for `ControlSurface.application()` method access.
  - Added fallback coverage for `Live.Application.get_application()`.
  - `npm run test:bridge`: 106 passed / 2 skipped.
- Corrected read-only JSON-RPC smoke against already-loaded Live process:
  - `system.hello`: bridge `ableton-mind/python`, version `0.1.0`, Live `12.4.1`, Python `3.11.6`, protocol `0.1`.
  - `system.ping`: `pong=true`.
  - `track.list`: total `7`, regular `4`, returns `2`.
  - `session.get_info`: tempo `120`, playing `false`, tracks `4`, returns `2`, master present.
  - `browser.get_categories`: still `available=false`, reason `browser unavailable (headless/no app)`.

The remaining browser validation requires toggling Live Preferences -> Link/Tempo/MIDI -> Control Surface from AbletonMind to None and back to AbletonMind so the Python Remote Script reloads from the current symlink.
