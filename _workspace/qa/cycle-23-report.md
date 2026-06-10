# QA Report - Cycle 23 - Environment Debts

**Date:** 2026-06-10  
**Verdict:** **BLOCKED for release gate**

## Summary

Cycle 23 ran two independent environment-debt tracks in parallel.

- TD-005: npm install environment is now verified on this machine.
- TD-030: Push hardware smoke is blocked because no Push 2/3 is connected or visible to CoreMIDI/USB.
- New TD-048: package validation is red on the current tree and blocks `v0.1.0-rc.1`.

## TD-005 - npm install environment

**Verdict:** PASS for the original environment debt.

Evidence from `_workspace/23_td005_summary.md`:

- `node --version`: `v26.3.0`
- `npm --version`: `11.16.0`
- `npm ci --dry-run`: PASS
- `npm ci` in a temporary clean copy: PASS, installed 421 packages

The original TD-005 issue was that npm install had not run in the sandbox. That is no longer true on the real machine. The remaining failures are validation failures, not npm-install failures.

## TD-030 - Push hardware smoke

**Verdict:** BLOCKED.

Evidence from `_workspace/23_td030_summary.md`:

- No USB device matched `Ableton`, `Push`, or `MIDI`.
- CoreMIDI reported no active sources and no active destinations.
- Ableton Live 12 Trial is running.
- The bridge is reachable on `127.0.0.1:9876`.
- `system.hello` returned bridge `0.0.21`, Live `12.4.1`, protocol `0.1`.
- Push unit tests passed, but unit tests are not a hardware smoke.

No Push Sysex was sent because no Push hardware was visible. TD-030 cannot close without an attached Push 2/3 and a real hardware response.

## TD-048 - package validation gate

**Verdict:** OPEN, blocks `v0.1.0-rc.1`.

During TD-005 validation, package-level checks failed:

- `npm run typecheck`: FAIL
- `npm test`: FAIL
- `npm run build`: FAIL
- `npm run build:dxt:check`: FAIL because build output was unavailable
- `npm pack --dry-run`: skipped because build/DXT prerequisites failed

These failures should be handled as a code/package-validation debt, not as TD-005.

## Gate Decision

- Close TD-005.
- Keep TD-030 open as environment-blocked.
- Open TD-048 for package validation before RC tagging.
- Do not tag `v0.1.0-rc.1` until TD-048 is fixed and the release gate is green.
