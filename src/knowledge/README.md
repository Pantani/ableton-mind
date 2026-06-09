# Knowledge base — schema convention

JSONs estáticos consumidos pelo loader em `src/knowledge/index.ts` (Zod-validado).

## Estrutura

```
src/knowledge/
├─ index.ts                # loader + Zod schemas
├─ scales.json             # 16 escalas + 12 root notes
├─ devices/
│  ├─ <id>.json            # 1 arquivo por device nativo do Live
│  └─ _extracted/          # output do scripts/extract-device-schemas.mjs (não distribuído)
└─ README.md               # este arquivo
```

## Device schema

```jsonc
{
  "$schema": "../device-schema.json",
  "id": "ableton.<slug>",
  "name": "Wavetable",
  "category": "instrument | audio_effect | midi_effect | drum_rack | rack",
  "vendor": "Ableton",
  "live_version_min": "10.0",      // semver string; tools podem filtrar
  "description": "...",
  "source": "curated (Cycle N)",   // ou "extracted-from-default-adv (sha256:...)"
  "completeness": "partial | complete | stub",
  "parameters": [
    { "index": 0, "name": "...", "min": 0, "max": 1, "default": 0.5, ... }
  ],
  "modulation_matrix": { ... },     // opcional, só instrumentos com mod matrix
  "todo": []
}
```

`.passthrough()` no Zod schema permite campos device-específicos extras
(ex: `drum_pads` em `drum_rack.json`).

## Convenção de `unit` (TD-041)

LLMs precisam saber **como interpretar `value`** ao chamar `device_set_parameter`. Lista canônica:

| Unit | Significado | Faixa típica | Exemplo |
|---|---|---|---|
| `linear` | Valor cru linear (espelha exatamente o slider do Live UI) | 0..1 ou -1..1 | Volume normalizado |
| `curve` | Valor cru 0..1 que mapeia para uma **curva interna não-linear** (Drive, Amount, Color, etc.). 0.5 ≠ "meio audível" — só meio do slider | 0..1 | Drum Buss Drive, Pedal Gain |
| `Hz` | Frequência em Hertz | 20..22000 | Filter Frequency |
| `dB` | Decibéis | -36..36 (variável) | Output Gain |
| `s` | Segundos | 0..60 | Envelope Attack |
| `ms` | Milissegundos | 0..1000 | Compressor Attack |
| `semitones`, `cents`, `octaves` | Pitch | -48..48 / -50..50 / -2..2 | Osc Transpose |
| `MIDI` | MIDI note number (0..127) | 0..127 | Pitch Tracking Note |
| `°` | Degrees (fase, stereo image) | 0..360 ou 0..120 | LFO Phase |
| `Q` | Q factor do filtro | 0.1..18 | EQ Resonance |
| `%` | Percent | 0..100 ou -100..100 | Filter Env Amount |
| `BPM` | Tempo | 20..999 | Looper Tempo |
| `bits` | Resolução | 1..16 | Redux Bit Depth |
| `voices`, `count` | Contagem discreta | 1..32 | Polyphony |
| `bool` | 0 ou 1 | 0..1 | On/Off switches |
| `enum` | Discrete choice index. `description` lista as opções | 0..N | Filter Type |
| `ratio` | Multiplicador (FM ratios) | 0.0625..32 | Operator A Coarse |

### Quando usar `linear` vs `curve`

- **`linear`**: usuário clica num ponto do slider → engine recebe esse valor sem transformação significativa. Ex: pan (-1..1), volume (0..1 antes da curva dB), Dry/Wet (0..1).
- **`curve`**: faixa visual é 0..1 mas engine aplica curva (logarítmica, exponencial, polinomial). Ex: Drum Buss Drive — 0.5 no slider produz drive bem mais sutil que metade do drive máximo, porque a curva é steep no final.

LLM deve assumir que **subir Drive/Amount de 0.5 → 0.8 não é "60% mais drive"** — é "mais alguns dB de drive segundo a curva". Para fine-tuning audível, varia 0.05 por chamada.

## Adicionar um device novo

1. `node scripts/extract-device-schemas.mjs --device <Name>` (se tiver `.adv` salvo)
2. Curador revisa output em `_extracted/`, completa `min/max/unit`, escolhe `linear` ou `curve` conforme acima.
3. Move para `devices/<slug>.json`.
4. Adiciona `<slug>` em `KNOWN_DEVICES` em `index.ts`.
5. Test em `tests/distribution-validation.test.ts` valida via `loadAllDevices()`.

## Scales

`scales.json` segue formato simples: 16 escalas + 12 root notes (intervals em semitones from root).

LLM pode combinar com `session.get_info` (que devolve `root_note` + `scale_name` do Live) para gerar notas dentro da escala atual.
