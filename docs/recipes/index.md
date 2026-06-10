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

**14 recipes** active across 7/7 categories (Cycle 22).

## Minimum schema

```jsonc
{
  "id": "techhouse-128-kit",
  "name": "Tech House 128 Kit",
  "tags": ["genre:tech-house", "bpm:128"],
  "variables": { "bpm": { "default": 128, "min": 120, "max": 132 } },
  "steps": [
    { "tool": "set_tempo", "args": { "bpm": "{{bpm}}" } },
    { "tool": "track_create", "args": { "type": "midi", "name": "Kick" } },
    { "ref": "drums.kick.punchy-tech" }
  ]
}
```

Full spec: [PLAN.md §6](https://github.com/Pantani/ableton-mind/blob/main/PLAN.md).
