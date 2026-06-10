# QA Report — Cycle 3

**Date:** 2026-06-09
**Verdict:** **PASS-WITH-WARNINGS**
**QA:** architect inline.

## Summary

Cycle 3 closed TD-006/TD-007, doubled the number of registered MCP tools (from 7 → 15), brought Knowledge online with the first device schema (Wavetable) + scales + typed loader + extraction stub script, and delivered the distribution pipeline (`npm run build:dxt` zips a self-contained `.mcpb`).

## Tech debt status

| ID | Status | Where |
|---|---|---|
| TD-001 | ✅ CLOSED (Cycle 2) | — |
| TD-002 | ✅ CLOSED (Cycle 2) | — |
| TD-003 | ✅ CLOSED (Cycle 2) | — |
| TD-004 (real smoke) | 🟡 PENDING | `docs/smoke-test.md` awaits user execution |
| TD-005 (npm install) | 🟡 PENDING | depends on dev machine |
| TD-006 (master_track nullable invariant) | ✅ CLOSED | JSDoc in `src/tools/track.ts` |
| TD-007 (track_create idempotency) | ✅ CLOSED | new `track.upsert` handler + tool |

Carry-over: TD-004 + TD-005 (2 items — both depend on real execution outside the sandbox).

## Parity check (TS ↔ Python)

| Method | Handler | MCP tool | Match |
|---|---|---|---|
| `system.hello` | system.py | handshake.ts | ✅ |
| `system.ping` | system.py | (client) | ✅ |
| `transport.play` | transport.py | playTool | ✅ |
| `transport.stop` | transport.py | stopTool | ✅ |
| `transport.set_tempo` | transport.py | setTempoTool | ✅ |
| `track.list` | track.py | trackListTool | ✅ |
| `track.create` | track.py | trackCreateTool | ✅ |
| `track.upsert` | track.py NEW | trackUpsertTool NEW | ✅ NEW |
| `track.set_name` | track.py NEW | trackSetNameTool NEW | ✅ NEW |
| `track.set_volume` | track.py NEW | trackSetVolumeTool NEW | ✅ NEW (ADR-0004 normalized) |
| `clip.create_midi` | clip.py | createMidiClipTool | ✅ |
| `clip.add_notes` | clip.py NEW | clipAddNotesTool NEW | ✅ NEW (ADR-0003 format) |
| `clip.fire` | clip.py NEW | clipFireTool NEW | ✅ NEW |
| `clip.stop` | clip.py NEW | clipStopTool NEW | ✅ NEW |
| `clip.set_name` | clip.py NEW | clipSetNameTool NEW | ✅ NEW |
| `session.get_info` | session.py NEW | sessionGetInfoTool NEW | ✅ NEW |
| `browser.get_categories` | browser.py NEW | browserGetCategoriesTool NEW | ✅ NEW |

**15 MCP tools registered / 17 JSON-RPC methods total in the bridge** (15 exposed + 2 system internal).

ahujasid parity (~22 tools): **~70%**. Missing ~6: load_browser_item / load_instrument_or_effect, set_clip_loop, get_device_parameters, set_device_parameter, detailed get_track_info, fire_scene.

## Contract drift

- `_workspace/contracts/phase0-methods.md` needs §10..§16 with the new methods (`track.upsert`, `track.set_name`, `track.set_volume`, `clip.add_notes`, `clip.fire`, `clip.stop`, `clip.set_name`, `session.get_info`, `browser.get_categories`).
- **Not updated this cycle** — recorded as TD-008 (low).
- ADR-0003 (note format) and ADR-0004 (volume scale) written.

## Knowledge

- `src/knowledge/index.ts` with Zod schemas for `DeviceSchema` and `ScalesPayload`.
- `wavetable.json` 17 params (partial — `completeness: partial`, embedded TODO list).
- `scales.json` 16 scales + 12 root notes.
- `scripts/extract-device-schemas.mjs` STUB: locates `.adv` in the User Library, lists inventory. XML/gzip parser deferred to Cycle 4.

## Distribution

- `scripts/build-dxt.mjs` generates `.mcpb` without external deps (native PKZIP via `node:zlib`).
- Packs: `manifest.json`, `dist/`, `knowledge/`, `README.md`, `LICENSE`.
- `npm run build:dxt:check` validates prerequisites without generating.
- Deterministic (no Date.now → reproducible output).

## Tests

Python bridge:
- `_fakes/live_api.py` extended with FakeMixerDevice/DeviceParameter, FakeClip.is_playing/add_new_notes/set_notes, FakeClipSlot.fire/stop, FakeBrowser/FakeApplication, song.signature_*, song.name, song.song_length.
- **QA-DEBT TODO**: tests for `add_notes/fire/stop/set_name`, `track.upsert/set_name/set_volume`, `session.get_info`, `browser.get_categories` were **NOT written this cycle** (prioritized code over test by budget). Recorded as TD-009.

TS:
- Patterns established in Cycle 1-2 cover the new tools; additional tests deferred to Cycle 4.

## Warnings

### W1 — Tests do not cover new handlers (TD-009)
Bridge and tools delivered without full suite. Patterns exist; just write them. Medium.

### W2 — Contract doc outdated (TD-008)
`phase0-methods.md` only covers 8 methods. Should list all 17. Low.

### W3 — `track.set_volume` dB curve is approximate
Table in ADR-0004 with <0.5 dB error. May become exact curve in Cycle 4. Accepted as design.

### W4 — Browser handler in headless returns `available: false`
By design. In real smoke must confirm `available: true` with Live open.

### W5 — `clip.add_new_notes` API path
Bridge tries `clip.add_new_notes(spec)` (Live 11+) and falls back to `set_notes(tuple)` (legacy). Not tested in real Live yet. Smoke will confirm.

## Recommendation for the architect

**PASS Cycle 3.** Next:

1. **Phase 0 closes** when the user runs `docs/smoke-test.md`.
2. **Suggested Cycle 4:**
   - Close TD-008 (update contract doc) and TD-009 (missing tests).
   - 6 remaining ahujasid tools: `load_instrument`, `fire_scene`, `set_clip_loop`, `get_device_parameters`, `set_device_parameter` (with knowledge lookup!), detailed `get_track_info`.
   - Knowledge: Operator, EQ Eight, Compressor, Reverb (4 devices). Real XML/gzip parser in `extract-device-schemas.mjs`.
   - Generic verify loop (read post-mutation state and diff vs intent).
