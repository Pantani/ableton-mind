# Usability Flow Audit 1

**Date:** 2026-06-10
**Mode:** read-only audit

## Checks

- `node scripts/install-remote-script.mjs --check`: PASS, but target points at another checkout.
- `node dist/cli/doctor.js`: PASS, but misses that mismatch.
- `node dist/index.js --help`: starts server instead of help.
- `node dist/index.js`: starts, connects bridge, registers 33 tools / 5 prompts / 3 resources.
- Package dry-run and DXT check passed.

## Findings

### MAJOR: Doctor approves Remote Script loaded from another checkout

- Evidence: `install-remote-script --check` reports target symlink to `/Users/pantani/Desktop/projects/art/ableton-mind/live/AbletonMind`, while the audited checkout is `/Users/pantani/.codex/worktrees/4656/ableton-mind`; `doctor` still reports all green.
- Risk: user edits/tests this worktree but Live runs another bridge.
- Suggested fix: in doctor, use `lstatSync`/`realpathSync`, show symlink target, and compare target with current package/source Remote Script path. Fail or warn on mismatch.
- Verification: point symlink at another checkout and expect doctor warning/failure; reinstall from current checkout and expect green.

### MAJOR: Main binary lacks `--help`/`--version` and starts MCP/Live

- Evidence: `src/index.ts` handles `chat`, `llm-run` and `ask`; unknown args fall through to MCP server startup. `node dist/index.js --help` connected to bridge and kept running.
- Risk: first-run help starts a Live-connected MCP server.
- Suggested fix: add `-h/--help`, `--version` and unknown-subcommand errors before creating the bridge client.
- Verification: `node dist/index.js --help` exits 0 without `bridge connected`; `node dist/index.js bogus` exits nonzero with usage.

### MAJOR: Unverifiable operations report `verified: true`

- Evidence: `src/feedback/verify.ts` defines `UNVERIFIABLE` with `ok: true`; transport tools map it to `verified: true`.
- Risk: async/unverifiable operations look fully verified to the LLM/user.
- Suggested fix: use `verified: false` plus a reason such as `unverifiable_async`, or extend the result schema with verification status.
- Verification: tests for `play`, `stop`, `clip_fire`, `scene_fire` should reject `verified: true` when no read-after-write is possible.

### MAJOR: DXT manifest lists only 6 of 33 runtime tools

- Evidence: `dxt/manifest.json` lists `play`, `stop`, `set_tempo`, `track_list`, `track_create`, `create_midi_clip`; runtime registry exposes 33 tools.
- Risk: one-click bundle metadata underrepresents core capabilities.
- Suggested fix: generate manifest tool metadata from the registry or remove the stale static list if optional.
- Verification: distribution test compares DXT tool list with `allTools`.

### MINOR: Docs claim universal invariants that not every tool satisfies

- Evidence: docs say every tool is idempotent/transactional/reversible/schema-aware and returns `{ ok, verified, diff }`; read-only and create tools have different semantics.
- Risk: users may assume destructive/repeatable operations are universally safe.
- Suggested fix: soften docs to "mutating tools prefer..." and document exceptions such as `track_create` versus `track_upsert`.
- Verification: docs grep/review plus optional metadata lint for exceptions.

### MINOR: Recipe loader can hide invalid recipes

- Evidence: `src/recipes/index.ts` catches and ignores JSON load errors; doctor only checks count.
- Risk: broken recipes disappear from `list_recipes` without a clear error.
- Suggested fix: ignore only `recipe-schema.json`; fail or warn on invalid recipe JSON with path.
- Verification: test with invalid recipe fixture expecting visible failure.

### MINOR: Remote Script README is stale

- Evidence: `live/AbletonMind/README.md` still describes Phase 0 and "not run in this cycle"; project progress records real Cycle 21 smoke pass.
- Risk: packaged users see outdated bridge status.
- Suggested fix: update README to v0.1.0 state and current commands.
- Verification: `rg 'Phase 0|Not run in this cycle' live/AbletonMind/README.md` should be empty or historical only.
