# Knowledge base

JSON estático embarcado no pacote. Objetivo: **o LLM nunca chuta nome, range, default ou unidade de parâmetro**.

## O que está indexado

- **55+ devices nativos** do Live 12 — instruments, effects, MIDI effects.
- **Packs** — Core Library + packs comerciais relevantes.
- **Scales** — escalas musicais com notas e modos.
- **Grooves** — groove pool indexado.
- **MIDI standards** — General MIDI, Drum Kit Standard.

> Spec: [PLAN.md §5](https://github.com/Pantani/ableton-mind/blob/main/PLAN.md).

## Schema de device (exemplo)

```jsonc
{
  "id": "wavetable",
  "name": "Wavetable",
  "category": "instrument",
  "vendor": "ableton",
  "params": [
    {
      "name": "Osc 1 Position",
      "index": 0,
      "min": 0.0,
      "max": 1.0,
      "default": 0.0,
      "unit": "norm",
      "quantized": false
    }
    // ...
  ]
}
```

Quando você diz "abre o Wavetable e seta Osc 1 Position pra 0.5", o servidor:

1. Resolve `Wavetable` no schema.
2. Mapeia `"Osc 1 Position"` → index 0.
3. Valida `0.5 ∈ [0.0, 1.0]`.
4. Chama o handler com `(device_id, index, value)`.
5. Re-lê e diffa.

## Extração

Pipeline em `scripts/extract-device-schemas.mjs` combina:

- Introspecção via bridge (`device_get_params`).
- Parsing de `Default.adv`.
- Curadoria manual.

Detalhes da skill `device-schema-extraction` no harness.
