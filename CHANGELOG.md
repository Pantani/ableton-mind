# Changelog

Todas as mudanças notáveis vão aqui. Formato [Keep a Changelog](https://keepachangelog.com/en/1.1.0/) + SemVer ([ADR-0009](_workspace/decisions/0009-release-versioning.md)).

## [Unreleased]

### Em preparação para `v0.1.0-rc.1`

- Smoke test real contra Live (TD-004) — gate de release.
- Validação final de Push 2/3 sysex em hardware (TD-030).

## [0.0.20] — 2026-06-09 (Cycle 20) — Wire smoke + Doctor 7

### Added
- TD-045 ✅ DXT manifest ganha `resources: [...]` array (3 entradas: session_state, knowledge_devices, recipes_index). Speculative — MCPB v0.2 deve aceitar; clientes mais antigos ignoram silently.
- **`live/AbletonMind/__main__.py`** — CLI entrypoint para rodar bridge headless: `python -m AbletonMind --port <p>`. Útil para smoke tests, validação manual e CI Python jobs.
- **`tests/wire-smoke.test.ts`** — opt-in via `RUN_WIRE_SMOKE=1`. Spawns bridge subprocess, conecta TS client over real TCP, exercises handshake + system.ping + track.list (espera -32000 sem Live). **Real wire-level test** — catches bugs that mocks miss (NDJSON framing, JSON-RPC envelope, dispatcher threading).
- Doctor CLI **7º check** `checkMcpPrimitives()` — conta tools/prompts/resources, falha se algum import quebrar (regressão detection).

### Changed
- Doctor CLI agora tem 7 checks (era 6).

## [0.0.19] — 2026-06-09 (Cycle 19) — MCP Resources subsystem 🎯 **3/3 primitivas MCP**

### Added
- **ADR-0011** — MCP Resources shape (`live://<scope>/<path>` URI namespace).
- **`src/resources/`** — registry + 3 seed resources:
  - `live://session/state` — deep snapshot do Live via bridge.
  - `live://knowledge/devices` — índice estático dos 55 devices (id, category, parameter_count).
  - `live://recipes/index` — índice das 14 recipes (id, step_count, input_count).
- **Server bootstrap** — `registerResource()` wira `server.resource(name, uri, metadata, readHandler)` do SDK 1.x.
- **Tool MCP** `list_resources` — fallback discovery.
- **TD-044** ✅ `tests/prompts.test.ts` — 16+ casos cobrindo registry + 5 handlers + listPromptsTool.
- **`tests/resources.test.ts`** — 10+ casos cobrindo 3 resources + listResourcesTool + erro handling.
- **Total tools MCP: 33** (era 32, +`list_resources`).
- **3/3 primitivas MCP entregues**: Tools (33) + Prompts (5) + Resources (3).

## [0.0.18] — 2026-06-09 (Cycle 18) — MCP Prompts subsystem

### Added
- **ADR-0010** — MCP Prompts shape.
- **`src/prompts/`** — registry + 5 seed prompts:
  - `create_genre_track` (techno/tech-house/dnb/jungle/lofi/hiphop/trap/neo-soul/ambient → tempo + recipe chain).
  - `build_mix_chain` (drums/bass/vocal/master → recipe + manual tweaks).
  - `build_arrangement` (intro-build-drop-break-outro / aaba / verse-chorus / minimal).
  - `sound_design_session` (synth + target → starting params + tweak loop).
  - `process_vocal_take` (style-aware vocal chain).
- **Server bootstrap** — `registerPrompt()` em `src/server/index.ts` wira ao `McpServer.prompt(name, desc, shape, handler)` do SDK 1.x.
- **Tool MCP** `list_prompts` — fallback discovery quando cliente MCP não expõe prompts nativamente.
- **DXT manifest** — `prompts: [...]` populado para Claude Desktop listar.
- **Total tools MCP: 32** (era 31, +`list_prompts`).

## [0.0.17] — 2026-06-09 (Cycle 17)

### Added
- TD-043 ✅ 5 MIDI effects restantes: Chord (6 shift+velocity slots), Note Length, Random, Scale, Velocity. **Knowledge: 55 devices** — 110% alvo PLAN.md §5.
- README PT-BR atualizado refletindo status real das phases + métricas (31 tools, 55 devices, ~800 params, 14 recipes, verify 23/23, 7 eventos).

## [0.0.16] — 2026-06-09 (Cycle 16) 🎯 **Knowledge 100% PLAN.md §5**

### Added
- Knowledge: **50 devices** (+5: Arpeggiator (MIDI), Spectrum (analyzer), Resonators, External Audio Effect, Channel EQ Live 12). **100% PLAN.md §5 target achieved.**
- Recipes: **14 recipes** (+`mixing/bass-glue` Channel EQ → Saturator Tape → Glue Comp, +`drums/lofi-kit` Drum Bus + Vinyl Distortion + Redux 12-bit + boom-bap 90 BPM).

### Changed
- TD-042 ✅ Re-anotação `unit: "curve"` em params não-lineares de devices antigos:
  - Drum Buss: Drive, Crunch, Compression, Boom.
  - Pedal: Gain.
  - Roar: Stage 1/2/3 Amount, Feedback Amount, Compressor Amount.
- Saturator Drive ganha description aclarando dependência de Type.

## [0.0.15] — 2026-06-09 (Cycle 15)

### Added
- TD-041 ✅ `src/knowledge/README.md` — convenção de `unit` documentada (linear vs curve + 16 unit types canônicos + processo de adicionar device).
- Knowledge: **45 devices** (+5: Cabinet, Dynamic Tube, Filter Delay, Grain Delay, Utility). **90% PLAN.md §5 target.**
- Recipes: **12 recipes** (+`drums/jungle-break` — Amen-style 170 BPM, +`bass/reese` — Operator detuned saws + Chorus-Ensemble).

## [0.0.14] — 2026-06-09 (Cycle 14, RC prep)

### Added
- TD-039 ✅ Doctor CLI checa version sync entre `package.json` e `dxt/manifest.json` (ADR-0009).
- TD-040 ✅ `docs/distribution.md` seção CI secrets (NPM_TOKEN, GITHUB_TOKEN perms, Smithery opcional, dry-run local).
- TD-038 ✅ `tests/distribution-validation.test.ts` — 14+ casos validando pkg/dxt sync, CHANGELOG format, GitHub workflows shape, Dockerfile, smithery.yaml, .npmignore, README/docs presence.
- Knowledge: **40 devices** (+2: Drum Buss, Redux). **80% PLAN.md §5 target.**
- Recipes: **10 recipes** (+`chords/lofi-jazz` — Operator Rhodes + Redux + Vinyl Distortion + Cmaj7-Am7-Fmaj7-G7).

## [0.0.13] — 2026-06-09 (Cycle 13)

### Added
- **Phase 7 finalização:** GitHub Actions CI (TS + Python + Docker matrices) e release workflow (npm + ghcr + GitHub Releases).
- `docs/distribution.md` — Docker Windows hint completo (TD-035), Smithery, dev install, troubleshooting.
- `.npmignore` whitelist defesa adicional (TD-036).
- `CHANGELOG.md` (este arquivo).
- ADR-0009 — release versioning + branching policy.
- Knowledge: **38 devices** (+5 Cycle 13: Meld, Pitch, Multiband Dynamics, EQ Three, Vinyl Distortion).
- Recipes: **9 recipes** — +`live_performance/launchpad-rig` (TD-037), +`racks/parallel-comp`. **7/7 categorias PLAN.md §6 cobertas.**

## [0.0.12] — 2026-06-09 (Cycle 12)

### Added
- **Phase 7 start:** `Dockerfile` (multi-stage Node 20 Alpine), `smithery.yaml`, `README.en.md`.
- TD-026 ✅ `tests/phase5-6-recipes.test.ts` — 24+ casos (Phase 5/6/recipes/knowledge integrity).
- TD-033 ✅ `package.json` bin `ableton-mind-doctor`.
- TD-034 ✅ neo-soul recipe aceita `instrument_path_*` overrides (Live 11/12 compat).
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
- **Phase 5 start:** `session.snapshot`, `session.diff`, `render.preview` — foundation para verify loop completo.
- **Recipes Trilha C estreia** (ADR-0007): loader Zod, runner mustache + dotted-let, `list_recipes`, `apply_recipe`.
- TD-024 ✅ Sampler completo (49 params + modulation_matrix).
- TD-025 ✅ `install_listener_methods` + `fire_listener` em `_fakes/live_api.py`.
- Knowledge: 20 devices (+5: Limiter, Glue Compressor, Bass, Drift, Hybrid Reverb).
- Recipes: 1 seed (`drums/tech-house-kick`).

## [0.0.8] — 2026-06-09 (Cycle 8)

### Added
- **Verify loop 23/23** — finalização TD-016. Read-only inherently verified; async UNVERIFIABLE sentinel.
- TD-019 ✅ `src/server/_mcp-internals.ts` — adapter centralizando acesso a SDK internals.
- TD-021 ✅ contract doc §25..§26.
- TD-022 ✅ 28+ casos de teste novos (Phase 4 + locator + SDK adapter + UNVERIFIABLE).
- TD-023 ✅ curve_type=hold implementação via 2-step split.
- Knowledge: 15 devices (+5: Drum Cell, Simpler, Sampler partial, Tuner, Phaser-Flanger).

## [0.0.7] — 2026-06-09 (Cycle 7)

### Added
- **Phase 4 start** (ADR-0006): automation envelopes. `clip.envelope_set_points`, `arrangement.add_automation_point`. `parameter_path` syntax + locator parser TS.
- **Phase 2 expansion**: 5 listeners novos (track name/mute/solo/volume + clip name/is_playing).
- 6 tools migradas para verify loop (TD-016 progress).
- TD-020 ✅ FakeDeviceParameter constructor.
- Knowledge: 10 devices (+5: Auto Filter, Echo, Saturator, Delay, Drum Rack).

## [0.0.6] — 2026-06-09 (Cycle 6)

### Added
- **Phase 2 functional**: end-to-end listeners → MCP notifications.
- TD-014 ✅ `BridgeServer.broadcast()` thread-safe NDJSON.
- TD-015 ✅ `src/server/notifications.ts` + forwarder.
- TD-017 ✅ contract doc §21..§24.
- TD-018 ✅ 29+ casos de teste novos.
- Knowledge: 5 devices (+4: Operator, EQ Eight, Compressor, Reverb).

## [0.0.5] — 2026-06-09 (Cycle 5)

### Added
- **Phase 1 fechada — paridade ahujasid 22/22.**
- **Phase 2 listeners scaffold** (ADR-0005): tempo + is_playing eventos.
- 3 tools knowledge-aware: `browser_load_item`, `device_get_parameters`, `device_set_parameter`.
- TD-012 ✅ Wavetable 60 params + modulation_matrix.
- TD-013 ✅ verify loop integrado em 4 tools.

## [0.0.4] — 2026-06-09 (Cycle 4)

### Added
- 3 tools: `track_get_info`, `scene_fire`, `clip_set_loop`.
- `src/feedback/verify.ts` — verify loop foundation.
- TD-008..TD-011 ✅ contract doc, Python + TS tests, real .adv parser (gunzip + sax-lite).

## [0.0.3] — 2026-06-09 (Cycle 3)

### Added
- 9 tools novas (clip/track/session/browser/scene).
- ADR-0003 (note format), ADR-0004 (volume scale).
- Knowledge: Wavetable seed + scales.json + loader Zod.
- Distribuição: `build:dxt.mjs` zipa `.mcpb` autocontido.

## [0.0.2] — 2026-06-08 (Cycle 2)

### Added
- 5 tools novas + `track.create` (primeira feature inédita).
- `dxt/manifest.json`, `scripts/install-remote-script.mjs`, `docs/smoke-test.md`.
- ADR-0002 — track.list shape via coleções.

### Fixed
- TD-001 (NaN env var), TD-002 (track.list indexes), TD-003 (naming).

## [0.0.1] — 2026-06-08 (Cycle 1, Phase 0 Spike)

### Added
- Repo scaffold (TS + Node 20 + tsup + biome + vitest).
- Python Remote Script (TCP NDJSON server + 7 handlers + LiveAPI mock).
- TS server (entry stdio + cliente TCP + handshake + tool `play`).
- ADR-0001 — stack/transport/licença/alvo.
- Contratos JSON-RPC frozen para Phase 0.
- `docs/architecture.md`.

[Unreleased]: https://github.com/Pantani/ableton-mind/compare/v0.0.13...HEAD
[0.0.13]: https://github.com/Pantani/ableton-mind/releases/tag/v0.0.13
