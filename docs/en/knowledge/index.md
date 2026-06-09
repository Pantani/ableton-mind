# Knowledge base

Static JSON shipped with the package. Goal: **the LLM never guesses parameter name, range, default, or unit**.

## What is indexed

- **55+ native Live 12 devices** — instruments, effects, MIDI effects.
- **Packs** — Core Library + relevant commercial packs.
- **Scales**, **grooves**, **MIDI standards** (GM, Drum Kit Standard).

> Spec: [PLAN.md §5](https://github.com/Pantani/ableton-mind/blob/main/PLAN.md).

## Device schema (example)

```jsonc
{
  "id": "wavetable",
  "name": "Wavetable",
  "category": "instrument",
  "vendor": "ableton",
  "params": [
    { "name": "Osc 1 Position", "index": 0, "min": 0.0, "max": 1.0, "default": 0.0, "unit": "norm" }
  ]
}
```

When you say "open Wavetable and set Osc 1 Position to 0.5", the server resolves the schema, maps the name to an index, validates the range, calls the handler, then re-reads and diffs.
