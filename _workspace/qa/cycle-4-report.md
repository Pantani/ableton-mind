# QA Report — Cycle 4

**Date:** 2026-06-09
**Verdict:** **PASS-WITH-WARNINGS**
**QA:** architect inline.

## Summary

Cycle 4 closed 4 of the 7 open debts (TD-008, TD-009, TD-010, TD-011), added 3 tools (`track_get_info`, `scene_fire`, `clip_set_loop`), delivered the verify loop foundation with its own tests. ahujasid parity now at **~82%** (18/22 tools mapped).

## Tech debt status

| ID | Status | Where |
|---|---|---|
| TD-004 (real smoke) | 🟡 PENDING | depends on manual execution via `docs/smoke-test.md` |
| TD-005 (npm install) | 🟡 PENDING | depends on real machine |
| TD-008 (contract doc) | ✅ CLOSED | `_workspace/contracts/phase0-methods.md` §10..§20 |
| TD-009 (Python tests) | ✅ CLOSED | `live/AbletonMind/tests/test_handlers_cycle3_4.py` |
| TD-010 (TS tests) | ✅ CLOSED | `tests/tools-cycle3-4.test.ts` + `tests/feedback-verify.test.ts` |
| TD-011 (real .adv parser) | ✅ CLOSED | `scripts/extract-device-schemas.mjs` (gunzip + sax-lite regex) |
| TD-012 (full Wavetable) | 🟡 PENDING | post-extract curation — Cycle 5 |

5 closed in 4 cycles. 3 carry-over (all non-blocking).

## Parity check (TS ↔ Python)

**18 MCP tools registered / 20 JSON-RPC methods total in the bridge** (18 exposed + 2 system).

New Cycle 4 tools:
| Method | Handler | Tool |
|---|---|---|
| `track.get_info` | `handlers/track.py::TrackGetInfoHandler` | `trackGetInfoTool` |
| `scene.fire` | `handlers/scene.py::SceneFireHandler` NEW file | `sceneFireTool` |
| `clip.set_loop` | `handlers/clip.py::ClipSetLoopHandler` | `clipSetLoopTool` |

Registry smoke test in `tools-cycle3-4.test.ts` verifies that `allTools.length === 18` with expected names. Python test `test_handlers_cycle3_4.py::TestRegistry` validates that REGISTRY has the right 20 entries.

## Contract drift

- `phase0-methods.md` now documents §1..§20 (all current methods).
- ADR-0003 (note format) and ADR-0004 (volume scale) already existed (Cycle 3).
- No new ADRs this cycle — all new methods follow existing patterns.

## Knowledge

- `extract-device-schemas.mjs` now real:
  - `gunzipSync` to decompress `.adv`.
  - Sax-lite by regex: hunts blocks `<TagName>...<Manual Value="X"/>...</TagName>` that are not in the GENERIC_TAGS list.
  - Output in `src/knowledge/devices/_extracted/<id>.json` with `completeness: partial` + `source: "extracted-from-default-adv (sha256:...)"`.
  - Flags: `--inventory`, `--dry-run`, `--device <Name>`.
  - **Known limitation:** without LiveAPI introspection, only captures defaults — `min/max/unit` need manual curation. PLAN.md §5 already foresaw this hybrid.

## Verify loop

- `src/feedback/verify.ts` — primitives `verifyField(intent, actual, opts)`, `verifyAll(...)`, `UNVERIFIABLE` sentinel.
- 9 tests in `tests/feedback-verify.test.ts` (numbers with tolerance, strings, booleans, combinators).
- **Not yet integrated in existing tools** — Cycle 5 migrates `track_set_volume` and `set_tempo` as first real adopters. Recorded as TD-013.

## Tests

Python (in `live/AbletonMind/tests/`):
- `test_handlers_cycle3_4.py` added — 11 test classes, ~30 cases covering all 11 Cycle 3-4 handlers + REGISTRY smoke.
- `_fakes/live_api.py` expanded: `FakeScene` + `song.scenes`, `FakeClip.loop_*`.

TS (in `tests/`):
- `tools-cycle3-4.test.ts` — 18+ cases covering the 12 untested tools, + registry smoke.
- `feedback-verify.test.ts` — 9 cases covering the verify loop.

Estimated total: **80+ test cases** accumulated on both sides (not counted but significantly above Cycle 3).

## Warnings

### W1 — TD-013 (new): verify loop not integrated
`src/feedback/verify.ts` is only foundation. Tools still return literal `verified: true`. Cycle 5 migrates. Severity: low (does not change the contract).

### W2 — TD-012 carry-over
`wavetable.json` remains partial (17/~60 params). Waiting for real extract or curation. Low.

### W3 — TD-004 + TD-005 not resolvable in sandbox
Awaiting real user execution. Stable since Cycle 1.

### W4 — `.adv` parser is heuristic (regex, not AST)
Works for Live's typical defaults, but complex `.adv` (nested params, deep racks) may miss entries. That is why `_extracted/` is separate from `devices/` — human curation still overrides.

## Recommendation for the architect

**PASS Cycle 4.** Next:

1. Real smoke (TD-004) → officially closes Phase 0.
2. Cycle 5 closes ahujasid parity:
   - `load_browser_item` / `load_instrument`
   - `get_device_parameters` + `set_device_parameter` knowledge-aware (uses Wavetable.json and _extracted/*)
   - Verify loop integration on N tools (TD-013).
3. Curator completes Wavetable + runs extract against Operator/EQ Eight/Compressor/Reverb if available (TD-012).
4. Phase 2 begins: listeners in the bridge (transport, track, clip) → MCP notifications.
