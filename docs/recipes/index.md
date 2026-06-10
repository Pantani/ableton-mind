# Recipes

**Declarative music recipes in JSON.** The LLM (or user) references a recipe and the server expands it into a tool sequence.

## Categories

| Folder | What's in it |
|---|---|
| `recipes/drums/` | Drum kits per genre (tech house, dnb, trap, …) |
| `recipes/bass/` | Basslines (rolling, reese, sub) |
| `recipes/chords/` | Progressions + voicings |
| `recipes/racks/` | Instrument/effect racks with mapped macros |
| `recipes/arrangements/` | Structures (intro/build/drop/break) |
| `recipes/mixing/` | Mix templates per genre |
| `recipes/live_performance/` | Performance setups (Push, follow actions) |

**14 recipes** active across 7/7 categories.

## Minimum schema

```jsonc
{
  "id": "drums/tech-house-kick",
  "name": "Tech-House Kick",
  "category": "drums",
  "version": "0.1",
  "tags": ["tech-house", "drums", "kick", "techno", "4-on-the-floor"],
  "inputs": {
    "track_name": { "type": "string", "default": "Kick" },
    "velocity": { "type": "int", "default": 100, "min": 1, "max": 127 }
  },
  "steps": [
    { "op": "track.upsert", "args": { "name": "{{track_name}}", "type": "midi" } },
    { "op": "clip.create_midi", "args": { "length_beats": 4, "name": "Kick" } }
  ]
}
```

Full spec: [PLAN.md §6](https://github.com/Pantani/ableton-mind/blob/main/PLAN.md).
