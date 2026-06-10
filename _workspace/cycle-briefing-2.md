# Cycle 2 — 2026-06-08

**PLAN.md Phase:** transition Phase 0 → Phase 1.
**Cycle goal:** close 5 tech debts from Cycle 1 + expose the 4 remaining bridge tools + 1 new handler (`track.create`) + Distribution stub.

## Strategy

**Inline execution by the architect** (no agent dispatch). Reason:
- Cycle 1 agents failed with a socket API error.
- Cycle 2 work is mostly surgical (point fixes + small files following already established patterns).
- Context cost < cost of redispatching and risking another failure.

If Cycle 3+ has large deliveries (50+ handlers, knowledge), it returns to agents.

## Inline assignments

### Track A — TS Server
1. Fix TD-001: tcp-client.ts env var parsing.
2. Expose `stop`, `set_tempo`, `track_list`, `create_midi_clip` as MCP tools in `src/tools/`.
3. Expose `track_create` (new tool).
4. Update `src/tools/index.ts` to include all.
5. Add tests for each new tool in `tests/`.

### Track A — Python Bridge
1. Fix TD-003: rename `LIVE_API_FAILED` → `LIVE_API_CALL_FAILED`.
2. Fix TD-002: change `track.list` shape to `{tracks, return_tracks, master_track, total}` (do not use negative indexes).
3. Add `track.create` handler in `handlers/track.py` + schema in `schemas.py`.
4. Update affected tests.

### Track D — Distribution (enters now)
1. Draft `dxt/manifest.json` for Claude Desktop one-click install (MCPB v0.2 spec).
2. Update root `README.md` with "Dev install" section.
3. Add `scripts/install-remote-script.mjs` (dev symlink — does not copy).

### Track — Docs (architect)
1. `docs/smoke-test.md` — step-by-step for the user to run the manual smoke (Phase 0 gate).

### QA (inline)
- Parity check after changes (track.list shape changed; track_create is new).
- Contract drift: phase0-methods.md will need a "phase 1 evolves track.list shape" note — but without mutating the contract itself.
- Record the track.list change in ADR-0002 (breaking change pre-1.0, OK).

## New/changed contracts

### track.list — breaking change
**ADR-0002** will document. New shape:
```ts
{
  tracks: TrackInfo[];        // only regular song.tracks, index = position in song.tracks
  return_tracks: TrackInfo[]; // only returns, index = position in song.return_tracks
  master_track: TrackInfo | null;
  total: number;              // sum(tracks) + sum(returns) + (master ? 1 : 0)
}
```

`TrackInfo` keeps the same fields as Cycle 1 (name, color_index, is_midi, is_audio, mute, solo, arm, is_grouped, is_foldable, etc) — but with `index` now being the position within its own collection.

Removes `is_return`/`is_master` from TrackInfo (the position in the collection already indicates it).

### track.create — new method

```ts
// request
{ type: "midi" | "audio"; index?: number; name?: string }

// response
{
  changed: true;
  track: {
    index: number;       // position in song.tracks after creation
    name: string;
    is_midi: boolean;
    is_audio: boolean;
  };
}
```

Errors: `-32004` if `index` is invalid (>= num_tracks + 1).

## Dependencies

- Distribution depends only on knowing the registered tools (does not block).
- The track.list shape change must be done **simultaneously** on both sides (TS accepts only the new shape, Python returns only the new shape). Coordinated inline change.
- New MCP tools (stop, set_tempo, etc) depend on the bridge handlers (existed since Cycle 1) — only TS changes.

## Gate criteria

- [ ] Tech debt TD-001, TD-002, TD-003 closed.
- [ ] TD-004 and TD-005 documented as accepted until Cycle 3.
- [ ] 4 new MCP tools registered + tested (mock).
- [ ] track.create handler + tool working (mock).
- [ ] dxt/manifest.json exists and has minimum fields.
- [ ] README has "Dev install" section.
- [ ] docs/smoke-test.md exists.
- [ ] ADR-0002 written.

## Next cycle (after this one)

- Real smoke (TD-004) — user runs it manually following `docs/smoke-test.md`.
- Phase 1 continued: remaining ahujasid tools (~15) + generic verify loop.
- Knowledge curator enters (Wavetable schema draft as a proof of concept).
