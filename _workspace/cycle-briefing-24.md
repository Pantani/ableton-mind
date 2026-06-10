# Cycle 24 Briefing — Phase 8 Long Tail Slice 1

**PLAN.md Phase:** Phase 8 — Long tail.
**Goal:** deliver the first testable Phase 8 slice: read-only Max for Live/plug-in introspection, Link/remote-DAW status discovery, and user-facing status/docs updates without claiming hardware or network integration that cannot be validated locally.

## Current baseline

- Release closure for `0.1.0` is green and ready for the final manual publish gate.
- TD-030 remains hardware-blocked: no Push 2/3 hardware smoke can close without physical hardware.
- Phase 8 currently has only MCP resources delivered; M4L/VST3/Live Link/mobile companion remain pending.
- Root docs are English; Portuguese localization stays under `docs/pt/`.
- There is a pre-existing local edit in `docs/.vitepress/config.ts`; do not revert it.

## Parallel assignments

### Track A — Bridge (`python-bridge-engineer`)

Owns:
- `live/AbletonMind/schemas.py`
- `live/AbletonMind/handlers/device.py`
- `live/AbletonMind/handlers/session.py` or a new read-only handler module if cleaner
- Python tests under `live/AbletonMind/tests/`

Tasks:
1. Add read-only bridge methods for Phase 8 discovery:
   - `device.inspect_patcher` for Max for Live-like device metadata.
   - `device.inspect_plugin` for VST/AU-like plug-in metadata and parameters.
   - `session.link_status` for Ableton Link/remote sync status where Live exposes it, with graceful `available=false` when unsupported by fakes/runtime.
2. Keep all operations read-only and Live-safe.
3. Return structured, typed JSON that does not depend on private Ableton objects existing in tests.
4. Add offline fake coverage for supported and unsupported shapes.

### Track A — Server (`ts-server-engineer`)

Owns:
- `src/tools/device.ts` or narrowly scoped new tool module(s)
- `src/tools/index.ts`
- TS tests under `tests/`

Tasks:
1. Add MCP tools that wrap the new bridge methods:
   - `device_inspect_patcher`
   - `device_inspect_plugin`
   - `session_link_status`
2. Validate inputs/outputs with Zod.
3. Keep them read-only and return `{ ok, verified }` where consistent with the repo pattern.
4. Add TS unit tests using mocked bridge calls.

### Track B — Knowledge (`knowledge-curator`)

Owns:
- New static knowledge files under `src/knowledge/` only if needed.
- Tests that validate knowledge shape only if adding files.

Tasks:
1. Decide the smallest useful static metadata for Phase 8 discovery, such as plug-in format names or M4L capability labels.
2. Avoid large speculative catalogs.
3. If adding files, ensure they are copied by the build or explicitly explain why runtime copy is unnecessary.

### Track C — Recipes (`recipe-designer`)

Owns:
- `recipes/`
- Recipe tests if adding recipes.

Tasks:
1. Add at most one Phase 8 recipe only if it can execute with existing tools today.
2. Do not add recipes that require unavailable M4L/VST3/Live Link mutation tools.
3. If no safe recipe exists, write a short `_workspace/24_recipes_summary.md` explaining why recipes are intentionally deferred.

### Track D — Distribution/Docs (`distribution-docs-engineer`)

Owns:
- `README.md`
- `docs/`
- `CHANGELOG.md`
- install/distribution docs

Tasks:
1. Update docs so Phase 8 says "slice 1 delivered" only for read-only introspection/status discovery.
2. Keep publication language accurate: gates green, public release not published, TD-030 hardware-blocked.
3. Preserve EN root + PT under `docs/pt`.
4. Do not revert the existing `docs/.vitepress/config.ts` local edit.

### Track E — QA (`qa-integration`)

Owns:
- `_workspace/qa/cycle-24-report.md`
- Cross-boundary contract checks.

Tasks:
1. Verify TS/Python method names and output shapes match.
2. Verify all new tools are registered.
3. Run focused tests plus full local gates when integration is ready.
4. Clearly classify Phase 8 remaining items: delivered, partial, blocked, or pending.

## Gate criteria

- New Phase 8 read-only bridge methods and MCP tools have focused TS + Python coverage.
- `npm run typecheck`, `npm run lint`, `npm test`, `npm run test:bridge`, `npm run build`, and `npm run docs:build` pass or failures are documented with exact blockers.
- `_workspace/PROGRESS.md` reflects Cycle 24 status.
- `_workspace/qa/cycle-24-report.md` exists and names any remaining Phase 8 gaps.

## Out of scope

- No destructive Live mutations.
- No real Push hardware closure unless hardware is physically available.
- No publication/tag/push/npm/GitHub Release without explicit final release approval.
- No full mobile companion app.
