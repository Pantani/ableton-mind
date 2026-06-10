# ADR 0003 — Canonical MIDI note format

**Date:** 2026-06-09
**Status:** Accepted
**Author:** architect

## Context

`clip.add_notes` needs to receive notes from the LLM and convert them to LiveAPI calls. Live 11+ has `Live.Clip.Clip.add_new_notes(specification: NoteSpecification)` accepting `{pitch, start_time, duration, velocity, mute}` (and per-note expression in Live 12 via a separate API).

## Decision

Canonical JSON format for a MIDI note:

```ts
{
  pitch: number;     // 0..127, integer (Middle C = 60, A4 = 69)
  start: number;     // beats from clip start (0 = first beat)
  duration: number;  // beats; > 0
  velocity?: number; // 0..127 integer; default 100
  mute?: boolean;    // default false
}
```

The notes array is the `notes: NoteSpec[]` of the request.

## Why

- `pitch`/`velocity` 0..127 (not MIDI hex, not note name) — the only format without enharmonic ambiguity.
- `start`/`duration` in beats (not ticks, not seconds) — aligns with clip length and tempo.
- `mute` exposed because LLMs want ghost notes for drum patterns.

## Out of scope (Phase 4)

- Per-note CC (MPE) — Live 12 exposes it; deferred.
- Probability — Live 11+ adds it; deferred.
- Release velocity — rare; deferred.

## How to apply

- `bridge/handlers/clip.py::add_notes` iterates, validates 0<=pitch<=127, 0<=velocity<=127, duration>0, and calls `clip.add_new_notes`.
- TS tool `clip_add_notes` defines a 1:1 Zod schema.
- The knowledge base will eventually expose a `pitch_from_name("C4")` helper for LLMs that send names — outside this Cycle's scope.
