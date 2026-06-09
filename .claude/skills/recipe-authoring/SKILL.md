---
name: recipe-authoring
description: Como escrever recipes musicais JSON do ableton-mind — patterns de drums, basslines, racks, arranjos, mixing por gênero. Define schema, variáveis, refs, params override-friendly, e pipeline de teste auditivo. Usar quando estiver criando ou revisando arquivos em recipes/ (drums, bass, chords, racks, arrangements, mixing, live_performance).
---

# Recipe Authoring — Patterns musicais em JSON

Skill consumido pelo `recipe-designer`. Define o que é um bom recipe e como autorar.

## O que é uma recipe

Um arquivo JSON declarativo que, executado pelo runtime do ableton-mind, produz no Live um pedaço de música funcional e estilisticamente coerente. Não é "qualquer combinação de tools": é o equivalente a um preset de cabeça inteira (estilo + setup + mixagem leve).

Boa recipe = som reconhecível do gênero + reaproveitável + override-friendly.

## Schema-mestre

```jsonc
{
  "$schema": "https://ableton-mind/recipe.schema.json",
  "name": "Tech House Drum Kit",
  "slug": "tech-house-drum-kit",
  "version": "1.0.0",
  "description": "Drum rack pré-configurado: kick punchy, clap analog, hat 909, ride open, perc shaker, sub kick.",
  "tags": ["drums", "tech-house", "house"],
  "tempo_range": [120, 130],
  "preview_audio": "preview/tech-house-drum-kit.wav",
  "params": {
    "intensity": {
      "type": "enum",
      "values": ["soft", "med", "hard"],
      "default": "med",
      "description": "Drive do drum bus e velocity dos hits."
    },
    "key": {
      "type": "note",
      "default": "A1",
      "description": "Note do kick (sub-bass)."
    }
  },
  "requires": {
    "live_min_version": "11",
    "packs": ["core-library"],
    "tools": ["create_midi_track", "load_device", "drum_rack_load_sample",
              "set_device_param_by_name", "apply_recipe"]
  },
  "steps": [
    { "tool": "create_midi_track", "params": { "name": "Drums" }, "as": "drums" },
    { "tool": "load_device",
      "params": { "track": "$drums", "uri": "Live:Instruments:DrumRack" }, "as": "rack" },
    { "tool": "drum_rack_load_sample",
      "params": { "rack": "$rack", "pad": 36,
                  "sample": "Live:Samples:Drums:Kick:HouseKick_01" } },
    { "tool": "load_device",
      "params": { "track": "$drums", "uri": "Live:AudioEffects:DrumBuss" },
      "as": "drumbuss" },
    { "tool": "set_device_param_by_name",
      "params": {
        "device": "$drumbuss", "name": "Drive",
        "value": { "$switch": "intensity", "soft": 0.15, "med": 0.30, "hard": 0.50 }
      } },
    { "tool": "apply_recipe",
      "params": { "name": "drums/tech-house-pattern",
                  "scope": { "track": "$drums", "intensity": "$intensity" } } }
  ],
  "verify": [
    { "check": "track_exists", "params": { "name": "Drums" } },
    { "check": "device_loaded", "params": { "track": "Drums", "device": "Drum Rack" } },
    { "check": "device_loaded", "params": { "track": "Drums", "device": "Drum Buss" } }
  ]
}
```

## Variáveis e refs

| Sintaxe | Significado |
|---|---|
| `$varname` | Referência ao step anterior nomeado com `"as"` |
| `$paramname` | Valor de `params.{paramname}` passado pelo usuário |
| `{ "$switch": "param", "case1": v1, "case2": v2 }` | Branch pelo valor do param |
| `{ "$if": "expr", "then": v1, "else": v2 }` | Condicional |
| `{ "$range": [min, max] }` | Random num range (com seed para reprodutibilidade) |
| `$next` | Próximo índice livre (para `create_midi_track {index: "$next"}`) |
| `$last` | Resultado do último step não-nomeado |

Runtime resolve em ordem. Recipe é dado, não código — sem loops nem conditionals em JS.

## Composição de recipes

Recipe pode chamar outra via `apply_recipe`. Use isso para:
- Separar **kit** (devices) de **pattern** (notes): `tech-house-drum-kit` cria o rack, `tech-house-pattern` toca as notas.
- Compartilhar racks utilitários: `sidechain-kick-to-bus` é chamado por qualquer recipe que queira sidechain.

Não aninhe além de 3 níveis. Se a árvore fica funda, simplifica.

## Pipeline de autoria

### 1. Referência

Antes de escrever, defina o que torna esse gênero **reconhecível**. Liste:
- 2-3 faixas canônicas (gravadas, conhecidas).
- 1-2 packs Ableton que cobrem esse som.
- 3-5 elementos sonoros não-negociáveis (ex: tech house = kick punchy + hat off-beat de 909 + bass groove rolling + clap analog).

Anota como bloco de comentário no `description` do recipe.

### 2. Esboço

Escreve o JSON com placeholders. Marca o que precisa de knowledge novo: `// TODO: knowledge-curator precisa de schema do EQ Three`.

### 3. Knowledge check

Antes de testar, valida que:
- Todo URI usado em `params.sample` ou `params.uri` está em `src/knowledge/packs/` ou `src/knowledge/devices/`.
- Todo `set_device_param_by_name` referencia param que está no schema do device.

Falta? Pede no chat do time ao `knowledge-curator` e marca `requires.packs` apropriado.

### 4. Aplicar + ouvir

Pede ao `ts-server-engineer` (via cycle-briefing) para rodar `apply_recipe` num Live aberto. Mexe nos faders, ouve. Avalia:

- O som "soa" do gênero? Sem isso, recipe é teoria genérica.
- As notas estão no grid certo do gênero (4/4 four-on-the-floor pra tech house, half-time pra D&B rollers)?
- O mix está balanceado o suficiente para ser ponto de partida (sem precisar de 20 ajustes pra ouvir)?

### 5. Iterar

Ajusta intensities, samples, params. Re-aplica. Para quando 2-3 ouvintes (você + 1 colega + 1 amigo músico) dizem "soa do gênero".

### 6. Variações

Roda com `params` extremos:
- `intensity: "soft"` ainda funciona?
- Tempo no extremo do `tempo_range` ainda funciona?
- `key` em outras notas ainda funciona?

Se quebra fora dos extremos, ajusta o `tempo_range` para refletir.

### 7. Documenta

- `description` clara, primeira pessoa do produto ("Drum rack…").
- `tags` úteis para search (incluir gênero, instrumento, vibe).
- (Opcional) `preview_audio` — render de 8 bars salvo em `recipes/preview/`.

## Categorias e arquivos

### `recipes/drums/`
Patterns + kits por gênero. Convenção:
- `{genre}-kit.json` — devices/rack
- `{genre}-pattern.json` — notas

Wave 1: tech-house, techno, dnb-rollers, dnb-amen, trap-808, lofi-boombap, ambient-perc, garage-shuffle.

### `recipes/bass/`
Basslines + patches. `sub-808`, `reese`, `acid-303`, `rolling-tech-house`, `jazz-upright`, `slap-bass`.

### `recipes/chords/`
Progressões + voicings. `neo-soul-rhodes`, `lofi-chop`, `ambient-pad-layers`, `jazz-extended`, `pop-evergreen`.

### `recipes/racks/`
Racks utilitários. `sidechain-kick-to-bus`, `parallel-comp`, `vocal-chain`, `drum-bus`, `mastering-light`, `tape-lofi`.

### `recipes/arrangements/`
Esqueletos. `tech-house-7min`, `ambient-12min`, `dnb-rollers-6min`, `pop-3min`, `lofi-loop-4min`. Locators + structure + tempo automation se for o caso.

### `recipes/mixing/`
Partidas de mix. `gain-staging-starter`, `master-bus-light`, `drum-bus`, `vocal-bus`.

### `recipes/live_performance/`
Setups para show. `push3-standalone`, `looper-setup`, `dj-deck-simulator`.

## Verify steps

Toda recipe tem array `verify` rodado pelo runtime depois de `steps`. Checks suportados:

| check | params | falha quando |
|---|---|---|
| `track_exists` | `{ name }` | não há track com esse nome |
| `device_loaded` | `{ track, device }` | track não tem device |
| `clip_exists` | `{ track, slot \| time }` | slot/timeline sem clip |
| `device_param_equals` | `{ track, device, name, value, tolerance? }` | param fora do esperado |

Falha em verify → tool retorna `{ ok: true, verified: false, failed_checks: [...] }`. ts-server reporta ao usuário.

## Antipatterns

| ❌ | ✅ |
|---|---|
| Recipe genérica "drums for any genre" | Recipe específica por gênero, com som reconhecível |
| 80 steps inline | Quebra em sub-recipes (kit + pattern + rack utility) |
| URIs hardcoded sem verificar pack | `requires.packs` declarado, validado |
| Sem `tempo_range` | `tempo_range` reflete onde o recipe soa bem |
| Sem teste auditivo | Recipe nunca chega em `recipes/` sem ouvir num Live real ou mock fiel |
| `intensity` ignorado | Cada param tem efeito audível, ou some |
