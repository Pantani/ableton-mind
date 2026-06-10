# Changelog

All notable changes go here. Format: [Keep a Changelog](https://keepachangelog.com/en/1.1.0/) + SemVer ([ADR-0009](_workspace/decisions/0009-release-versioning.md)).

## [Unreleased]

### In preparation for `v0.1.0-rc.1`

- Real smoke test against Live (TD-004) — passed in Cycle 21 against Ableton Live 12.4.1 on macOS.
- Package validation blocker (TD-048): `typecheck`, tests, build and DXT check must be green before RC.
- Final Push 2/3 sysex validation on hardware (TD-030) remains hardware-blocked.

### Changed

- Reworked VitePress docs into artist and developer paths, added first-set and prompt-cookbook guides, and clarified that public npm/`.mcpb` channels are not published yet.

## [0.0.21] — 2026-06-09 (Cycle 22) — Smoke-discovered fixes

### Fixed
- **TD-046** ✅ `system.hello` now returns `version` read from `package.json` at module load (no longer hardcoded `"0.0.1"`). Cached in `BRIDGE_VERSION`. Fallback `"0.0.0+unknown"` if package.json is not bundled.
- **TD-047** ✅ `_live_version()` now tries 3 Live API paths:
  1. `Application.get_major_version() / get_minor_version() / get_bugfix_version()` (Live 11+).
  2. `Application.get_major_minor_patch_version()` (tuple, older builds).
  3. `Application.get_version_string()` (rare fallback).
  Returns `"0.0.0"` only if all fail (e.g., environment without the `Live` module).

## [0.0.20] — 2026-06-09 (Cycle 20) — Wire smoke + Doctor 7

### Added
- TD-045 ✅ DXT manifest gains a `resources: [...]` array (3 entries: session_state, knowledge_devices, recipes_index). Speculative — MCPB v0.2 should accept; older clients silently ignore.
- **`live/AbletonMind/__main__.py`** — CLI entrypoint to run the bridge headless: `python -m AbletonMind --port <p>`. Useful for smoke tests, manual validation, and Python CI jobs.
- **`tests/wire-smoke.test.ts`** — opt-in via `RUN_WIRE_SMOKE=1`. Spawns the bridge subprocess, connects the TS client over real TCP, exercises handshake + system.ping + track.list (expects -32000 without Live). **Real wire-level test** — catches bugs mocks miss (NDJSON framing, JSON-RPC envelope, dispatcher threading).
- Doctor CLI **7th check** `checkMcpPrimitives()` — counts tools/prompts/resources, fails if any import breaks (regression detection).

### Changed
- Doctor CLI now has 7 checks (was 6).

## [0.0.19] — 2026-06-09 (Cycle 19) — MCP Resources subsystem 🎯 **3/3 MCP primitives**

### Added
- **ADR-0011** — MCP Resources shape (`live://<scope>/<path>` URI namespace).
- **`src/resources/`** — registry + 3 seed resources:
  - `live://session/state` — deep snapshot of Live via the bridge.
  - `live://knowledge/devices` — static index of the 55 devices (id, category, parameter_count).
  - `live://recipes/index` — index of the 14 recipes (id, step_count, input_count).
- **Server bootstrap** — `registerResource()` wires `server.resource(name, uri, metadata, readHandler)` from SDK 1.x.
- **MCP tool** `list_resources` — fallback discovery.
- **TD-044** ✅ `tests/prompts.test.ts` — 16+ cases covering registry + 5 handlers + listPromptsTool.
- **`tests/resources.test.ts`** — 10+ cases covering 3 resources + listResourcesTool + error handling.
- **Total MCP tools: 33** (was 32, +`list_resources`).
- **3/3 MCP primitives delivered**: Tools (33) + Prompts (5) + Resources (3).

## [0.0.18] — 2026-06-09 (Cycle 18) — MCP Prompts subsystem

### Added
- **ADR-0010** — MCP Prompts shape.
- **`src/prompts/`** — registry + 5 seed prompts:
  - `create_genre_track` (techno/tech-house/dnb/jungle/lofi/hiphop/trap/neo-soul/ambient → tempo + recipe chain).
  - `build_mix_chain` (drums/bass/vocal/master → recipe + manual tweaks).
  - `build_arrangement` (intro-build-drop-break-outro / aaba / verse-chorus / minimal).
  - `sound_design_session` (synth + target → starting params + tweak loop).
  - `process_vocal_take` (style-aware vocal chain).
- **Server bootstrap** — `registerPrompt()` in `src/server/index.ts` wires to SDK 1.x `McpServer.prompt(name, desc, shape, handler)`.
- **MCP tool** `list_prompts` — fallback discovery when the MCP client does not expose prompts natively.
- **DXT manifest** — `prompts: [...]` populated for Claude Desktop to list.
- **Total MCP tools: 32** (was 31, +`list_prompts`).

## [0.0.17] — 2026-06-09 (Cycle 17)

### Added
- TD-043 ✅ 5 remaining MIDI effects: Chord (6 shift+velocity slots), Note Length, Random, Scale, Velocity. **Knowledge: 55 devices** — 110% of PLAN.md §5 target.
- README updated to reflect the real status of phases + metrics (31 tools, 55 devices, ~800 params, 14 recipes, verify 23/23, 7 events).

## [0.0.16] — 2026-06-09 (Cycle 16) 🎯 **Knowledge 100% PLAN.md §5**

### Added
- Knowledge: **50 devices** (+5: Arpeggiator (MIDI), Spectrum (analyzer), Resonators, External Audio Effect, Channel EQ Live 12). **100% PLAN.md §5 target achieved.**
- Recipes: **14 recipes** (+`mixing/bass-glue` Channel EQ → Saturator Tape → Glue Comp, +`drums/lofi-kit` Drum Bus + Vinyl Distortion + Redux 12-bit + boom-bap 90 BPM).

### Changed
- TD-042 ✅ Re-annotation `unit: "curve"` on non-linear params of older devices:
  - Drum Buss: Drive, Crunch, Compression, Boom.
  - Pedal: Gain.
  - Roar: Stage 1/2/3 Amount, Feedback Amount, Compressor Amount.
- Saturator Drive gains a description clarifying dependency on Type.

## [0.0.15] — 2026-06-09 (Cycle 15)

### Added
- TD-041 ✅ `src/knowledge/README.md` — `unit` convention documented (linear vs curve + 16 canonical unit types + process for adding a device).
- Knowledge: **45 devices** (+5: Cabinet, Dynamic Tube, Filter Delay, Grain Delay, Utility). **90% PLAN.md §5 target.**
- Recipes: **12 recipes** (+`drums/jungle-break` — Amen-style 170 BPM, +`bass/reese` — Operator detuned saws + Chorus-Ensemble).

## [0.0.14] — 2026-06-09 (Cycle 14, RC prep)

### Added
- TD-039 ✅ Doctor CLI checks version sync between `package.json` and `dxt/manifest.json` (ADR-0009).
- TD-040 ✅ `docs/distribution.md` CI secrets section (NPM_TOKEN, GITHUB_TOKEN perms, optional Smithery, local dry-run).
- TD-038 ✅ `tests/distribution-validation.test.ts` — 14+ cases validating pkg/dxt sync, CHANGELOG format, GitHub workflows shape, Dockerfile, smithery.yaml, .npmignore, README/docs presence.
- Knowledge: **40 devices** (+2: Drum Buss, Redux). **80% PLAN.md §5 target.**
- Recipes: **10 recipes** (+`chords/lofi-jazz` — Operator Rhodes + Redux + Vinyl Distortion + Cmaj7-Am7-Fmaj7-G7).

## [0.0.13] — 2026-06-09 (Cycle 13)

### Added
- **Phase 7 finalization:** GitHub Actions CI (TS + Python + Docker matrices) and release workflow (npm + ghcr + GitHub Releases).
- `docs/distribution.md` — complete Docker Windows hint (TD-035), Smithery, dev install, troubleshooting.
- `.npmignore` whitelist as additional defense (TD-036).
- `CHANGELOG.md` (this file).
- ADR-0009 — release versioning + branching policy.
- Knowledge: **38 devices** (+5 Cycle 13: Meld, Pitch, Multiband Dynamics, EQ Three, Vinyl Distortion).
- Recipes: **9 recipes** — +`live_performance/launchpad-rig` (TD-037), +`racks/parallel-comp`. **7/7 PLAN.md §6 categories covered.**

## [0.0.12] — 2026-06-09 (Cycle 12)

### Added
- **Phase 7 start:** `Dockerfile` (multi-stage Node 20 Alpine), `smithery.yaml`, and root README updates.
- TD-026 ✅ `tests/phase5-6-recipes.test.ts` — 24+ cases (Phase 5/6/recipes/knowledge integrity).
- TD-033 ✅ `package.json` bin `ableton-mind-doctor`.
- TD-034 ✅ neo-soul recipe accepts `instrument_path_*` overrides (Live 11/12 compat).
- Knowledge: 33 devices (+5: Looper, Spectral Resonator, Spectral Time, Shifter, Chorus-Ensemble).
- Recipes: 7 (+`mixing/vocal-chain`, +`arrangements/tech-house-7min`).

## [0.0.11] — 2026-06-09 (Cycle 11)

### Added
- Phase 6 expansion: `push.set_mode` (note/session/drum/step).
- **Phase 7 start:** `ableton-mind-doctor` CLI (`src/cli/doctor.ts`).
- TD-031 ✅ Roar + Erosion devices.
- TD-032 ✅ `recipes/racks/sidechain-rack.json`.
- Knowledge: 28 devices (+5: Roar, Erosion, Gate, Auto Pan, Frequency Shifter).
- Recipes: 5 (+sidechain-rack, +neo-soul-progressions).

## [0.0.10] — 2026-06-09 (Cycle 10)

### Added
- **Phase 6 start:** Push 2/3 control (ADR-0008). `push.set_pad_color`, `push.set_button_led`. Sysex F0 00 21 1D 01 01.
- TD-027/028/029 ✅ contract doc §27..§31, recipe-schema.json, recipe load step.
- Knowledge: 23 devices (+Pedal, Beat Repeat, Vocoder).
- Recipes: 3 (+sub-808, +master-bus).

## [0.0.9] — 2026-06-09 (Cycle 9)

### Added
- **Phase 5 start:** `session.snapshot`, `session.diff`, `render.preview` — foundation for the full verify loop.
- **Recipes Track C debut** (ADR-0007): Zod loader, mustache + dotted-let runner, `list_recipes`, `apply_recipe`.
- TD-024 ✅ Full Sampler (49 params + modulation_matrix).
- TD-025 ✅ `install_listener_methods` + `fire_listener` in `_fakes/live_api.py`.
- Knowledge: 20 devices (+5: Limiter, Glue Compressor, Bass, Drift, Hybrid Reverb).
- Recipes: 1 seed (`drums/tech-house-kick`).

## [0.0.8] — 2026-06-09 (Cycle 8)

### Added
- **Verify loop 23/23** — TD-016 finalized. Read-only inherently verified; async UNVERIFIABLE sentinel.
- TD-019 ✅ `src/server/_mcp-internals.ts` — adapter centralizing access to SDK internals.
- TD-021 ✅ contract doc §25..§26.
- TD-022 ✅ 28+ new test cases (Phase 4 + locator + SDK adapter + UNVERIFIABLE).
- TD-023 ✅ curve_type=hold implementation via 2-step split.
- Knowledge: 15 devices (+5: Drum Cell, Simpler, Sampler partial, Tuner, Phaser-Flanger).

## [0.0.7] — 2026-06-09 (Cycle 7)

### Added
- **Phase 4 start** (ADR-0006): automation envelopes. `clip.envelope_set_points`, `arrangement.add_automation_point`. `parameter_path` syntax + TS locator parser.
- **Phase 2 expansion**: 5 new listeners (track name/mute/solo/volume + clip name/is_playing).
- 6 tools migrated to the verify loop (TD-016 progress).
- TD-020 ✅ FakeDeviceParameter constructor.
- Knowledge: 10 devices (+5: Auto Filter, Echo, Saturator, Delay, Drum Rack).

## [0.0.6] — 2026-06-09 (Cycle 6)

### Added
- **Phase 2 functional**: end-to-end listeners → MCP notifications.
- TD-014 ✅ `BridgeServer.broadcast()` thread-safe NDJSON.
- TD-015 ✅ `src/server/notifications.ts` + forwarder.
- TD-017 ✅ contract doc §21..§24.
- TD-018 ✅ 29+ new test cases.
- Knowledge: 5 devices (+4: Operator, EQ Eight, Compressor, Reverb).

## [0.0.5] — 2026-06-09 (Cycle 5)

### Added
- **Phase 1 closed — ahujasid parity 22/22.**
- **Phase 2 listeners scaffold** (ADR-0005): tempo + is_playing events.
- 3 knowledge-aware tools: `browser_load_item`, `device_get_parameters`, `device_set_parameter`.
- TD-012 ✅ Wavetable 60 params + modulation_matrix.
- TD-013 ✅ verify loop integrated in 4 tools.

## [0.0.4] — 2026-06-09 (Cycle 4)

### Added
- 3 tools: `track_get_info`, `scene_fire`, `clip_set_loop`.
- `src/feedback/verify.ts` — verify loop foundation.
- TD-008..TD-011 ✅ contract doc, Python + TS tests, real .adv parser (gunzip + sax-lite).

## [0.0.3] — 2026-06-09 (Cycle 3)

### Added
- 9 new tools (clip/track/session/browser/scene).
- ADR-0003 (note format), ADR-0004 (volume scale).
- Knowledge: Wavetable seed + scales.json + Zod loader.
- Distribution: `build:dxt.mjs` zips a self-contained `.mcpb`.

## [0.0.2] — 2026-06-08 (Cycle 2)

### Added
- 5 new tools + `track.create` (first net-new feature).
- `dxt/manifest.json`, `scripts/install-remote-script.mjs`, `docs/smoke-test.md`.
- ADR-0002 — track.list shape via collections.

### Fixed
- TD-001 (NaN env var), TD-002 (track.list indexes), TD-003 (naming).

## [0.0.1] — 2026-06-08 (Cycle 1, Phase 0 Spike)

### Added
- Repo scaffold (TS + Node 20 + tsup + biome + vitest).
- Python Remote Script (TCP NDJSON server + 7 handlers + LiveAPI mock).
- TS server (stdio entry + TCP client + handshake + `play` tool).
- ADR-0001 — stack/transport/license/target.
- Frozen JSON-RPC contracts for Phase 0.
- `docs/architecture.md`.

[Unreleased]: https://github.com/Pantani/ableton-mind/compare/v0.0.13...HEAD
[0.0.13]: https://github.com/Pantani/ableton-mind/releases/tag/v0.0.13
