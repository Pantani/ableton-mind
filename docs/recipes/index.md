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

**14 recipes** ativas em 7/7 categorias (Cycle 22).

## Schema mínimo

```jsonc
{
  "id": "techhouse-128-kit",
  "name": "Tech House 128 Kit",
  "tags": ["genre:tech-house", "bpm:128"],
  "variables": {
    "bpm": { "default": 128, "min": 120, "max": 132 }
  },
  "steps": [
    { "tool": "set_tempo", "args": { "bpm": "{{bpm}}" } },
    { "tool": "track_create", "args": { "type": "midi", "name": "Kick" } },
    { "ref": "drums.kick.punchy-tech" }
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
