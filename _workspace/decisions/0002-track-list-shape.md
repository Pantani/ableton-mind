# ADR 0002 — `track.list` shape: collections instead of negative indexes

**Date:** 2026-06-08
**Status:** Accepted
**Author:** architect
**Supersedes:** part of `_workspace/contracts/phase0-methods.md §6` (`track.list` response table)

## Context

Cycle 1 delivered `track.list` with provisional indexing:
- `index >= 0` → regular track
- `index = -1` → master
- `index = -2..-N` → return tracks

Documented in TD-002 as debt. PLAN.md §4.2 lists master/return as first-class entities in the LOM — Live exposes them via `song.tracks`, `song.return_tracks`, `song.master_track` (separate collections).

## Decision

`track.list` now returns separate collections:

```ts
{
  tracks: TrackInfo[];          // only song.tracks (audio + MIDI + group)
  return_tracks: TrackInfo[];   // only song.return_tracks
  master_track: TrackInfo | null; // only song.master_track (always present in real runtime, null in tests)
  total: number;                // sum(tracks) + sum(return_tracks) + (master_track ? 1 : 0)
}
```

`TrackInfo` loses the `is_return` and `is_master` fields (the collection in which the object appears already says it). Keeps:
- `index: number` (position in its own collection starting at 0)
- `name`, `color_index`
- `is_midi`, `is_audio`
- `mute`, `solo`, `arm` (master has no arm; already documented)
- `is_grouped`, `is_foldable`

## Why

- Aligns with Live's real LOM (`Song.tracks`, `Song.return_tracks`, `Song.master_track`).
- Ends the magic convention of negative indexes (a source of bugs in subsequent calls — e.g. `clip.create_midi` could receive `track_index=-1` by mistake and try to create a clip on the master).
- TypeScript becomes more expressive (`master_track: TrackInfo | null` is checkable).

## Consequences

- **Breaking change** vs Cycle 1, but Phase 0 still in pre-release (v0.0.x) → accepted without deprecation window.
- Update contract `_workspace/contracts/phase0-methods.md §6` with a note pointing to this ADR.
- Update Python handler `live/AbletonMind/handlers/track.py`.
- Update affected Python tests.
- TS tool `track_list` maps 1:1 (no extra transformation).

## How to apply

- Implemented in this very Cycle 2 (architect inline).
- Future tools that receive track index (`clip.create_midi`, `track.set`, etc) continue to use `track_index` as a position in regular `song.tracks` — return/master are opted-in via prefix (Phase 2+).
