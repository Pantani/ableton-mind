# Cycle 3 — 2026-06-09

**PLAN.md Phase:** Phase 1 (ahujasid parity) in progress. Phase 0 closed in code (real smoke still depends on manual user execution).

**Goal:** expand LOM coverage with 8 new tools (clip mutators, track set_name/volume, session info, browser categories), close TD-006/TD-007, the knowledge curator enters with Wavetable, distribution delivers `npm run build:dxt`.

## Strategy

**Inline execution by the architect** (same decision as Cycles 1-2 — background agents have a history of API error and this cycle's work is mostly small files following already established patterns).

## Inline assignments

### Track A — Python Bridge
1. **TD-007:** `track.upsert` handler in `handlers/track.py` (idempotent; creates only if name=X does not exist).
2. **8 new handlers:**
   - `clip.add_notes` — adds an array of MIDI notes to an existing clip (transactional).
   - `clip.fire` — triggers a clip slot.
   - `clip.stop` — stops the clip playing in a clip slot.
   - `clip.set_name` — renames a clip.
   - `track.set_name`
   - `track.set_volume` (in dB or 0..1? — ADR decides)
   - `session.get_info` — read-only, returns {num_tracks, num_returns, has_master, tempo, time_signature, is_playing, song_time, name}.
   - `browser.get_categories` — read-only, lists the Live Browser's categories.
3. Schemas in `schemas.py`.
4. Tests in `tests/test_handlers_*.py` for each.

### Track A — TS Server
1. **TD-006:** document the `master_track` invariant in the `track_list` tool's JSDoc.
2. 9 new MCP tools (the 8 above + `track_upsert`):
   - `track_upsert`, `track_set_name`, `track_set_volume` → `src/tools/track.ts`
   - `clip_add_notes`, `clip_fire`, `clip_stop`, `clip_set_name` → `src/tools/clip.ts`
   - `session_get_info` → `src/tools/session.ts` (new)
   - `browser_get_categories` → `src/tools/browser.ts` (new)
3. Update `src/tools/index.ts` registry.
4. Tests in `tests/tools-*.test.ts`.

### Track B — Knowledge (enters now)
1. `src/knowledge/devices/wavetable.json` — partial Wavetable schema (parameters visible in the foreground UI first: Osc1 Position, Osc2 Position, Filter Freq, Env1 A/D/S/R, etc).
2. `src/knowledge/index.ts` — loader that returns devices/scales/grooves.
3. `src/knowledge/scales.json` — basic bootstrap (Major/Minor/Dorian/Phrygian/Lydian/Mixolydian/Aeolian/Locrian + root notes).
4. `scripts/extract-device-schemas.mjs` — STUB with `Default.adv` lookup in the User Library + rudimentary XML parser + "TODO complete" warning.

### Track D — Distribution
1. `scripts/build-dxt.mjs` — bundles `dist/`, `dxt/manifest.json`, `README.md`, `LICENSE`, optionally `src/knowledge/`, into a `.mcpb` zip.
2. `package.json` `scripts`: `"build:dxt": "node scripts/build-dxt.mjs"`.

## New contracts

### ADR-0003 — MIDI note format in `clip.add_notes`
Decided: `{ pitch: 0-127, velocity: 0-127 default 100, start: float beats, duration: float beats, mute: bool default false }`. Maps directly to Live 11+ `clip.add_new_notes` (no per-note MPE CC in this phase; Phase 4 adds it).

### ADR-0004 — `track.set_volume` scale
Decided: `volume: 0.0..1.0` (normalized, as exposed by the LiveAPI `track.mixer_device.volume.value`). Conversion to dB is in an optional TS helper.

## Dependencies

- Knowledge does not block anything in this phase (pure data).
- Distribution depends on `dist/index.js` existing (TS build running) — but the script only fails at runtime when run.
- `clip.add_notes` depends on `clip.create_midi` existing (already exists).
- `track.upsert` reuses `track.create` internally.

## Gate criteria

- [ ] TD-006/TD-007 closed.
- [ ] 8 handlers + 9 tools registered, with mock-only tests.
- [ ] Knowledge: Wavetable.json + scales.json exist; loader compiles.
- [ ] `scripts/build-dxt.mjs` exists (does not need to run successfully in the sandbox — just `node --check` passing).
- [ ] ADR-0003 and ADR-0004 recorded.
- [ ] PROGRESS.md updated.

## Next cycle

- Phase 1 cont.: remaining ahujasid tools (~6) + generic verify loop.
- Knowledge: Operator + Drum Rack + 5 audio effects (Reverb, EQ Eight, Glue, Auto Filter, Compressor).
- Real smoke (TD-004 still open) — user or QA runs it.
