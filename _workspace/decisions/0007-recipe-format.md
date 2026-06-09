# ADR 0007 — Recipe format

**Data:** 2026-06-09
**Status:** Aceito
**Autor:** architect

## Contexto

PLAN.md §6 promete recipes declarativas. LLM pede "tech-house kick", `ableton-mind` expande para sequência de tool calls. Precisa formato.

## Decisão

### Shape do recipe JSON

```jsonc
{
  "$schema": "../recipe-schema.json",
  "id": "drums/tech-house-kick",
  "name": "Tech-House Kick",
  "category": "drums",
  "version": "0.1",
  "description": "Kick drum tech-house: Drum Cell tunado para -2 semitons, saturação leve, 4-on-the-floor pattern em 1 bar.",
  "tags": ["tech-house", "drums", "kick", "techno"],
  "inputs": {
    "track_name": { "type": "string", "default": "Kick" },
    "track_index": { "type": "int", "default": -1, "description": "-1 = append no fim." },
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

### Campos obrigatórios

- `id` (`{categoria}/{slug}` único)
- `name`, `category`, `version`
- `steps[]` (array de operações JSON-RPC)

### Inputs (parametrização)

`inputs` declara params overridáveis pelo LLM. Cada input tem `type`, `default`, opcionalmente `min/max/enum/description`.

Substituição via mustache simples: `"{{input_name}}"` em qualquer string.

Acesso a resultados via `let` + dotted path: `let: "kick_track"` em step.0; depois `"{{kick_track.track.index}}"`.

### Categorias

`drums`, `bass`, `chords`, `racks`, `arrangements`, `mixing`, `live_performance`. Espelha PLAN.md §6.

### Execução (apply_recipe)

1. Loader Zod-valida o JSON.
2. Resolver inputs com defaults + overrides do LLM.
3. Para cada step: substitui placeholders, chama `bridge.call(op, args)`, guarda result em `let` se especificado.
4. Erro num step → para execução, devolve `{ applied: false, completed: i, failed_at: step, error }`.
5. Sucesso → `{ applied: true, steps: N, recipe_id }`.

Não há rollback automático (Phase 6 adiciona via undo batch).

### Sem condicionais / loops

Phase 5: recipes são lineares. Phase 6 pode adicionar `for_each`, `if`.

### Knowledge-aware

`device.set_parameter` com `parameter_name` (não index) usa a knowledge automaticamente via tool TS.

## Consequências

- `src/recipes/index.ts` loader + Zod schema.
- `src/recipes/runner.ts` executor (substitui placeholders, chama bridge).
- `src/tools/recipe.ts` expõe `apply_recipe` + `list_recipes`.
- `recipes/` na raiz (espelhando structure de `src/recipes/registry.json`).
- Recipes embedded no pacote npm — LLM nunca precisa GitHub-fetchar.

## Como aplicar

- Cycle 9: 1 recipe seed (`tech-house-kick`) + loader + apply_recipe + ADR.
- Cycle 10+: expande para 5-10 recipes por categoria.
