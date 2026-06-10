# ADR 0007 — Recipe format

**Date:** 2026-06-09
**Status:** Accepted
**Author:** architect

## Context

PLAN.md §6 promises declarative recipes. The LLM asks for a "tech-house kick", `ableton-mind` expands it into a sequence of tool calls. A format is needed.

## Decision

### Recipe JSON shape

```jsonc
{
  "$schema": "../recipe-schema.json",
  "id": "drums/tech-house-kick",
  "name": "Tech-House Kick",
  "category": "drums",
  "version": "0.1",
  "description": "Tech-house kick drum: Drum Cell tuned to -2 semitones, light saturation, 4-on-the-floor pattern in 1 bar.",
  "tags": ["tech-house", "drums", "kick", "techno"],
  "inputs": {
    "track_name": { "type": "string", "default": "Kick" },
    "track_index": { "type": "int", "default": -1, "description": "-1 = append at the end." },
    "tune_semitones": { "type": "number", "default": -2, "min": -12, "max": 12 }
  },
  "steps": [
    {
      "op": "track.upsert",
      "args": { "name": "{{track_name}}", "type": "midi", "index": "{{track_index}}" },
      "let": "kick_track"
    },
    {
      "op": "browser.load_item",
      "args": { "path": ["drums", "Drum Cell", "Kicks", "Kick 808"] }
    },
    {
      "op": "device.set_parameter",
      "args": { "track_index": "{{kick_track.track.index}}", "device_index": 0, "parameter_name": "Tune", "value": "{{tune_semitones}}" }
    },
    {
      "op": "device.set_parameter",
      "args": { "track_index": "{{kick_track.track.index}}", "device_index": 0, "parameter_name": "Saturation", "value": 0.2 }
    },
    {
      "op": "clip.create_midi",
      "args": { "track_index": "{{kick_track.track.index}}", "clip_slot_index": 0, "length_beats": 4.0, "name": "Kick" }
    },
    {
      "op": "clip.add_notes",
      "args": {
        "track_index": "{{kick_track.track.index}}",
        "clip_slot_index": 0,
        "notes": [
          { "pitch": 36, "start": 0, "duration": 0.25, "velocity": 100 },
          { "pitch": 36, "start": 1, "duration": 0.25, "velocity": 100 },
          { "pitch": 36, "start": 2, "duration": 0.25, "velocity": 100 },
          { "pitch": 36, "start": 3, "duration": 0.25, "velocity": 100 }
        ]
      }
    }
  ]
}
```

### Required fields

- `id` (unique `{category}/{slug}`)
- `name`, `category`, `version`
- `steps[]` (array of JSON-RPC operations)

### Inputs (parameterization)

`inputs` declares LLM-overridable params. Each input has `type`, `default`, optionally `min/max/enum/description`.

Substitution via simple mustache: `"{{input_name}}"` in any string.

Access to results via `let` + dotted path: `let: "kick_track"` in step.0; later `"{{kick_track.track.index}}"`.

### Categories

`drums`, `bass`, `chords`, `racks`, `arrangements`, `mixing`, `live_performance`. Mirrors PLAN.md §6.

### Execution (apply_recipe)

1. Loader Zod-validates the JSON.
2. Resolve inputs with defaults + LLM overrides.
3. For each step: substitute placeholders, call `bridge.call(op, args)`, save result in `let` if specified.
4. Error in a step → stops execution, returns `{ applied: false, completed: i, failed_at: step, error }`.
5. Success → `{ applied: true, steps: N, recipe_id }`.

There is no automatic rollback (Phase 6 adds it via undo batch).

### No conditionals / loops

Phase 5: recipes are linear. Phase 6 may add `for_each`, `if`.

### Knowledge-aware

`device.set_parameter` with `parameter_name` (not index) uses the knowledge automatically via the TS tool.

## Consequences

- `src/recipes/index.ts` loader + Zod schema.
- `src/recipes/runner.ts` executor (substitutes placeholders, calls bridge).
- `src/tools/recipe.ts` exposes `apply_recipe` + `list_recipes`.
- `recipes/` at root (mirroring the structure of `src/recipes/registry.json`).
- Recipes embedded in the npm package — the LLM never needs to GitHub-fetch.

## How to apply

- Cycle 9: 1 seed recipe (`tech-house-kick`) + loader + apply_recipe + ADR.
- Cycle 10+: expands to 5-10 recipes per category.
