# Recipes

**Receitas musicais declarativas em JSON.** Em vez de descrever passo-a-passo cada tool, o LLM (ou o usuário) referencia uma recipe e o servidor expande em uma sequência de tools.

## Categorias

| Pasta | O que tem |
|---|---|
| `recipes/drums/` | Drum kits por gênero (tech house, dnb, trap, …) |
| `recipes/bass/` | Basslines (rolling, reese, sub) |
| `recipes/chords/` | Progressões + voicings |
| `recipes/racks/` | Instrument/effect racks com macros mapeadas |
| `recipes/arrangements/` | Estruturas (intro/build/drop/break) |
| `recipes/mixing/` | Mix templates por gênero |
| `recipes/live_performance/` | Setups de performance (Push, follow actions) |

**14 recipes** ativas em 7/7 categorias.

## Schema mínimo

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

## Override-friendly

Cada param é override-friendly: usuário troca `bpm`, `key`, `swing`, `kit_pack` sem editar o JSON.

## Lint

`scripts/qa/recipe-lint.mjs` valida:

- Tools referenciadas existem.
- `ref:` aponta para recipe real.
- URIs de knowledge resolvem.
- Variables têm default + range.

Spec completa: [PLAN.md §6](https://github.com/Pantani/ableton-mind/blob/main/PLAN.md).
