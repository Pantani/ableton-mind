# Cycle 4 — 2026-06-09

**PLAN.md Phase:** Phase 1 (ahujasid parity) advancing — target ~18/22 tools by end of this cycle.
**Goal:** close Cycle 3 debts (TD-008..011), add 3 tools (`get_track_info`, `fire_scene`, `set_clip_loop`), found the verify loop. TD-012 (complete Wavetable) and `load_instrument`/`set_device_parameter` tools deferred to Cycle 5.

## Strategy

Inline by the architect — patterns 100% established, no reason to dispatch background agents. Auto mode continues.

## Inline assignments

### Track A — Python Bridge
1. 3 new handlers: `track.get_info` (detailed get_track_info), `scene.fire`, `clip.set_loop`.
2. Corresponding schemas + fakes.
3. TD-009: tests for the 8 Cycle 3 handlers that were left without coverage.

### Track A — TS Server
1. 3 MCP tools mapping the handlers above.
2. `src/feedback/verify.ts` — generic utility for the verify loop (reads state after mutation, compares with intent, returns `{ ok, diff }`).
3. Integrate verify into the `track_set_volume` handler as a proof of concept.
4. TD-010: tests for the 9 Cycle 3 tools that were left without coverage.

### Track B — Knowledge
1. TD-011: real `.adv` parser in `scripts/extract-device-schemas.mjs` (gunzip + sax-lite).
2. Save 1 device as proof: run against Wavetable's `Default.adv` if it exists; if not, generate `src/knowledge/devices/_extracted/sample.json` with synthetic data.

### Track D — Distribution
No inline action (build:dxt is OK until packaging changes come). Cycle 5 will need to list packs in the manifest if the user requests it.

### Architect
1. TD-008: §10..§16 in `_workspace/contracts/phase0-methods.md` documenting the 9 Cycle 3 methods.
2. `ADR-0005` if the verify loop shape needs a recorded decision.

## New contracts

- `track.get_info` — read-only, detailed per track (name, color, mute/solo/arm, volume, pan, num_sends, num_clips, num_devices, current_input/output_routing).
- `scene.fire` — triggers a scene by index.
- `clip.set_loop` — `{track_index, clip_slot_index, loop_start?, loop_end?, looping?}`. Idempotent.

## Dependencies

- Verify loop needs to read post-mutation state → reuses `track.get_info` for volume verify; other tools can mock.
- .adv parser does not block tools — only populates knowledge.

## Gate criteria

- [ ] TD-008..011 closed.
- [ ] 3 handlers + 3 tools registered.
- [ ] `src/feedback/verify.ts` exists with at least 1 real caller.
- [ ] PROGRESS.md updated reflecting 18/22 tools.

## Next cycle

Cycle 5:
- Close full ahujasid parity: `load_instrument` + `get/set_device_parameter` (knowledge-aware).
- 4 devices: Operator, EQ Eight, Compressor, Reverb.
- Complete Wavetable (TD-012).
- Real smoke (TD-004).
- Phase 2 begins: listeners → MCP notifications.
