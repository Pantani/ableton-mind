---
name: device-schema-extraction
description: Como extrair, completar e validar schemas JSON dos devices nativos do Live para a knowledge base do ableton-mind. Combina introspecção via bridge + parsing de Default.adv + curadoria manual. Usar quando estiver populando src/knowledge/devices/, indexando packs em src/knowledge/packs/, ou escrevendo scripts/extract-device-schemas.mjs.
---

# Device Schema Extraction — Knowledge curation

Skill consumido pelo `knowledge-curator`. Define o pipeline para popular `src/knowledge/devices/` com schemas confiáveis.

## Fontes (em ordem de confiabilidade)

| Fonte | Confiável para | Como acessar |
|---|---|---|
| **Introspecção via bridge** | `parameters[i].name/min/max/value/is_quantized/value_string` | Bridge instancia device numa track temp, lê propriedades, devolve |
| **`Default.adv` XML** | Parâmetros default, presets, estrutura | Arquivo dentro do Live.app (`Contents/.../Default.adv`) ou pack |
| **Docs Ableton (manual oficial)** | Descrições, semântica, dependências entre params | Manual em PDF/HTML |
| **LOM reference** | Quais propriedades existem no `device` em si | `https://docs.cycling74.com/apiref/lom/` |
| **Comunidade (forum, GitHub)** | Edge cases, behavior pouco documentado | Cross-check apenas |

## Schema-mestre de device

```jsonc
{
  "$schema": "https://ableton-mind/device.schema.json",
  "uri": "Live:Instruments:Wavetable",
  "name": "Wavetable",
  "class_name": "OriginalSimpler",   // o nome interno via LOM, pode diferir
  "category": "synthesizer",
  "type": "instrument",               // instrument | audio_effect | midi_effect | rack
  "live_min_version": "10",
  "live_max_version": null,
  "polyphony": 16,
  "description": "Wavetable synth with 2 oscs, sub, 2 filters, mod matrix, FX.",
  "parameters": [
    {
      "index": 0,
      "name": "Osc 1 Position",
      "alias": ["osc1_pos"],          // nomes alternativos aceitos por set_device_param_by_name
      "min": 0.0,
      "max": 1.0,
      "default": 0.0,
      "unit": "normalized",            // normalized | hz | db | ms | semitones | cents | percent | enum
      "is_quantized": false,
      "automation": true,
      "modulation": true,
      "depends_on": null,              // ex: "Osc 1 Mode" — params que ativam/desativam este
      "description": "Position within wavetable for oscillator 1.",
      "source": "introspection+manual" // introspection | adv | manual | docs
    }
  ],
  "presets_default": [
    { "name": "Bass Wobble", "uri": "Live:Instruments:Wavetable:Bass:Wobble.adv" }
  ],
  "macro_targets_typical": ["Filter Cutoff", "Osc 1 Position", "Sub Volume"],
  "tips": [
    "Use Filter 1 Drive para tom analógico.",
    "Modular Osc 1 Position pelo LFO cria evolução de timbre clássica."
  ]
}
```

## Pipeline (passo a passo)

### Passo 1 — Introspecção via bridge

Script `scripts/extract-device-schemas.mjs` faz isso:

1. Conecta na bridge.
2. Pede para criar track MIDI temp.
3. Pede para carregar device por URI (ex: `Live:Instruments:Wavetable`).
4. Pede `device.list_params_full()` (handler dedicado a essa extração).
5. Recebe array de `{ index, name, min, max, value, is_quantized, value_string }`.
6. Pede para deletar a track (cleanup).
7. Salva em `_workspace/extraction/{slug}.raw.json`.

Handler bridge dedicado:

```python
# live/AbletonMind/handlers/introspection.py
@register("introspection.list_device_params")
class ListDeviceParamsHandler(Handler):
    def execute(self, params):
        track = self.song.tracks[params.track_index]
        device = track.devices[params.device_index]
        return {
            "name": device.name,
            "class_name": device.class_name,
            "type": str(device.type),  # 1=audio, 2=instr, 4=midi
            "parameters": [
                {
                    "index": i,
                    "name": p.name,
                    "min": float(p.min),
                    "max": float(p.max),
                    "default_value": float(p.default_value) if hasattr(p, "default_value") else None,
                    "value": float(p.value),
                    "is_quantized": bool(p.is_quantized),
                    "value_string": str(p.value_items[int(p.value)]) if p.is_quantized and hasattr(p, "value_items") else None,
                }
                for i, p in enumerate(device.parameters)
            ],
        }
```

### Passo 2 — Parse de `Default.adv`

`.adv` é gzip+XML. Você lê para:
- Pegar valores `default` (introspecção dá `value` atual, que pode não ser o default).
- Ver estrutura de macros + chains (para racks).
- Listar presets distribuídos no pack.

Script `scripts/parse-adv.mjs`:
```js
import { gunzipSync } from "node:zlib";
import { readFileSync } from "node:fs";
import { XMLParser } from "fast-xml-parser";

export function readAdv(path) {
  const buf = readFileSync(path);
  const xml = gunzipSync(buf).toString("utf-8");
  return new XMLParser({ ignoreAttributes: false }).parse(xml);
}
```

### Passo 3 — Curadoria manual

Pega `_workspace/extraction/{slug}.raw.json`, abre, completa:
- `description` (1-2 linhas, voltado para LLM, "como usar").
- `unit` (introspecção dá só min/max numérico — você sabe se é Hz, dB, %, ms).
- `automation`/`modulation` (a maioria true, alguns false; cross-check com Live).
- `depends_on` (Wavetable: `Osc 1 Effect 1` depende de `Osc 1 Mode`).
- `alias` (nomes curtos que o LLM/usuário pode pedir: `cutoff`, `res`, `drive`).
- `tips` (1-3 dicas operacionais).
- `macro_targets_typical` (params mais úteis em macros).
- `source` (anota a origem de cada parâmetro: `introspection`, `manual`, `docs`).

### Passo 4 — Validação

Script `scripts/validate-knowledge.mjs`:
- JSON valida contra `src/knowledge/_schema/device.json`.
- Todos os params têm `name` único.
- `min < max`.
- `unit` é um dos valores permitidos.
- `live_min_version` <= versão Live testada.
- Roda CI a cada PR.

### Passo 5 — Teste de uso

Ts-server-engineer roda:
```
set_device_param_by_name {
  track: N, device: 0,
  name: "Osc 1 Position",
  value: 0.7
}
```

Tool resolve "Osc 1 Position" → index 0 via knowledge → seta. Se falhar, knowledge está errado, volta para passo 3.

## Indexação de packs

`src/knowledge/packs/{pack-slug}.json`:

```jsonc
{
  "slug": "core-library",
  "name": "Core Library",
  "version": "12.0",
  "live_min_version": "11",
  "categories": [
    {
      "name": "Drums",
      "path": "Live:Samples:Drums",
      "subcategories": [
        { "name": "Kick", "path": "Live:Samples:Drums:Kick",
          "samples": ["HouseKick_01.wav", "TechnoKick_03.wav"] }
      ]
    }
  ]
}
```

Catalogação inicial: scan via bridge (`browser.list_at_path`), normaliza nomes, exporta JSON. Não memoriza todo o pack — só as categorias que recipes vão usar.

## Devices prioritários (Wave 1 - obrigatórios para v1.0)

**Instrumentos:**
Wavetable, Operator, Drift, Bass, Simpler, Sampler, Drum Sampler, Drum Rack, Instrument Rack, Impulse.

**Audio Effects (essenciais):**
EQ Eight, EQ Three, Glue Compressor, Compressor, Drum Buss, Saturator, Roar, Reverb, Hybrid Reverb, Echo, Delay, Auto Filter, Auto Pan, Utility, Limiter.

**MIDI Effects:**
Arpeggiator, Scale, Velocity, Chord, Pitch, Random.

Wave 2 (após v1.0): demais devices nativos.

## Antipatterns

| ❌ | ✅ |
|---|---|
| Inventar URIs sem testar | Bridge confirma instanciação |
| Descrição igual ao nome do param ("Osc 1 Position: position of osc 1") | Descreve uso ("Posição no wavetable para osc 1, varre timbres") |
| Schema sem `source` | Toda fonte rastreada |
| Misturar Live 10 e Live 12 num só schema | `live_min_version`/`live_max_version` explícitos, e múltiplos schemas se necessário |
| Bater olho e marcar `automation: true` | Cruza com `is_quantized` + teste real |
