# Fix Wave 3

**Date:** 2026-06-10

## Scope

- Fix Remote Script install-target mismatch.
- Fix `browser.get_categories` Application access path.
- Retry read-only Live smoke.

## Changes

- Reinstalled the Remote Script symlink with `node scripts/install-remote-script.mjs --force`.
- Updated `live/AbletonMind/handlers/browser.py`:
  - supports `ControlSurface.application()` when Application is exposed as a method;
  - falls back to `Live.Application.get_application()` when the ControlSurface does not expose Application directly.
- Added browser regression tests in `live/AbletonMind/tests/test_handlers_cycle3_4.py`.

## Verification

- RED: `test_lists_categories_when_application_is_method` failed before the handler fix.
- RED: `test_lists_categories_from_live_application_fallback` failed before the fallback fix.
- GREEN: targeted browser/cycle test file passed.
- GREEN: `npm run test:bridge` passed with 106 tests / 2 skips.
- GREEN: `npm run lint:py`.
- GREEN: `npm run complexity:py`.
- GREEN: `node dist/cli/doctor.js`.

## Live Retest

Read-only JSON-RPC smoke against the already-running Live process still returns:

- `browser.get_categories`: `available=false`, reason `browser unavailable (headless/no app)`.

This does not prove the code fix failed because Live had not reloaded the Python Remote Script after the symlink and source changes. Final validation requires reselecting the AbletonMind Control Surface in Live and running the read-only smoke again.
