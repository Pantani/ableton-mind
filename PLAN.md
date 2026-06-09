# ableton-mind — Planejamento do MCP definitivo para Ableton Live

> "Crie um tech house de 128 BPM com kick four-on-the-floor, baixo rolling, hats off-beat, vocal chop com sidechain e abertura de filtro no drop."
>
> …e o set aparece pronto dentro do Live: tracks, devices, clips, automation, mixer, racks. Tocando.

Documento de planejamento para **ableton-mind**: um servidor MCP (Model Context Protocol) para o Ableton Live no mesmo padrão do `tdmcp` (TouchDesigner). Objetivo: ser **o** MCP de Ableton, de forma que ninguém precise escrever outro.

---

## 1. Por que outro MCP de Ableton

Já existem dois projetos no espaço, e nenhum chega perto de "definitivo":

| Projeto | O que é | Limitação principal |
|---|---|---|
| [`ahujasid/ableton-mcp`](https://github.com/ahujasid/ableton-mcp) | MCP server + Remote Script (TCP socket, JSON). 22 tools. | Cobre só criação básica de tracks/clips/MIDI. Sem automation, return/master, racks, modulation, recording, undo, routing, listeners, warping, browser navegável, Push, Max for Live. |
| [`ideoforms/AbletonOSC`](https://github.com/ideoforms/AbletonOSC) | Remote Script que expõe ~95% do LOM via OSC (porta 11000/11001). | Não é MCP. Não tem knowledge base. Não tem recipes. Não tem feedback loop. Wrapper MCP existente (`nozomi-koborinai/ableton-osc-mcp`) é fino. |

**O que falta no mercado** (e é o que o ableton-mind vai entregar):

1. **Cobertura LOM total** — todo objeto, propriedade, método e listener da Live Object Model 12.x, não um subset.
2. **Knowledge base embarcada** — todos os devices nativos do Live (Wavetable, Operator, Drift, Meld, Bass, Drum Sampler, Simpler, Sampler, todos os audio effects, MIDI effects), parâmetros, ranges, defaults, packs oficiais, Max for Live API. O LLM para de chutar.
3. **Recipes musicais** — biblioteca de padrões prontos como JSON: drum patterns por gênero, basslines, progressões, arranjos, racks de drum, presets de mixagem. O equivalente aos "recipes" do tdmcp (`feedback_network_basic.json`, `particle_galaxy.json`).
4. **Loop create → verify → preview** — depois de gerar, lê o estado de volta, valida (a track tem o device certo? o clip tem as notas certas?), e oferece preview (render parcial, screenshot da Session View, áudio bounce de 8 bars).
5. **Listeners reativos** — o assistente pode "ouvir" o Live (beat atual, clipe tocando, parâmetro mudando) para gerar conteúdo em tempo real sincronizado.
6. **Push & Move** — integração com Push 3 e Move (controladores Ableton), inclusive standalone mode.
7. **Padrão tdmcp** — TS/Node MCP server + bridge Python no Live, DXT/MCPB pro Claude Desktop, npm/Smithery/Docker, CI, docs em PT-BR.

---

## 2. Princípios de design

| Princípio | O que significa na prática |
|---|---|
| **Cobertura total da LOM** | Nada de "ah isso não dá pra fazer". Se o Max for Live consegue, o ableton-mind consegue. |
| **Idempotência** | `create_midi_track {index: 3, name: "Bass"}` chamado 2x não cria 2 tracks. Tools checam estado antes de mutar. |
| **Transações** | Operações compostas (criar track + carregar device + tocar clip) são atômicas com undo unitário. Usa `Song.begin_undo_step()` / `end_undo_step()`. |
| **Reversibilidade** | Toda tool destrutiva (delete_track, remove_notes) snapshota antes. `undo_last_operation` rola tudo de volta. |
| **Read-before-write** | Antes de gerar, lê. Sabe que existe Track 3, sabe que é MIDI, sabe que devices ela tem. |
| **Recipes > Prompts** | Para padrões repetitivos (drum kit techno, baixo D&B), recipes JSON > 200 linhas de prompt. |
| **Knowledge > Guessing** | Todo device tem seu schema embarcado. LLM nunca precisa adivinhar que Wavetable tem `Osc 1 Position`. |
| **Sem dependências externas pesadas** | Funciona com Live nativo. AbletonOSC virá como **opcional** para usuários que já têm. |

---

## 3. Arquitetura

Três peças conversando localmente, no mesmo padrão do tdmcp:

```
   Você + AI                ableton-mind                Ableton Live
  (Claude/Cursor)    ─▶  (MCP server TS/Node)   ─▶  (Remote Script Python)
   "techno 128 BPM,                                     cria tracks, devices,
    kick + bass + pad"                                  clips, automation
```

### 3.1 Camadas

| Camada | Stack | Responsabilidade |
|---|---|---|
| **MCP Server** | TypeScript + Node 20+, SDK MCP oficial (`@modelcontextprotocol/sdk`) | Expõe tools/resources/prompts. Valida inputs com Zod. Roteia para o bridge. Carrega knowledge base + recipes. |
| **Bridge** (Remote Script) | Python 3 dentro do Live (Live usa Python 3.11 desde a 12.x) | Roda dentro do Live como MIDI Remote Script. Servidor TCP local (porta 9876 por padrão, configurável). Recebe JSON-RPC, executa via LiveAPI, devolve estado. |
| **Knowledge** | JSON + Markdown estático embutido no pacote | Schemas de devices, packs, MIDI ranges, escalas, escalas de groove, mapeamentos de drum kits. |

### 3.2 Protocolo bridge ↔ server

JSON-RPC 2.0 sobre TCP socket local. Mensagens curtas e idempotentes:

```jsonc
// request
{ "jsonrpc": "2.0", "id": 42, "method": "track.set", 
  "params": { "index": 3, "props": { "name": "Bass", "color_index": 14 } } }

// response (success)
{ "jsonrpc": "2.0", "id": 42, "result": { 
  "track": { "index": 3, "name": "Bass", "color_index": 14, "is_midi": true } } }

// response (error)
{ "jsonrpc": "2.0", "id": 42, "error": { 
  "code": -32004, "message": "Track 3 does not exist", "data": { "num_tracks": 3 } } }

// async event (listener push, server → client)
{ "jsonrpc": "2.0", "method": "event.beat", 
  "params": { "beat": 17, "bar": 5, "song_time": 17.0 } }
```

Por que JSON-RPC em vez de OSC nativo:
- **Tipado**: usa Zod no lado TS, dataclasses no lado Python.
- **Erros estruturados**: AbletonOSC só responde "/live/error msg" — frustrante de debugar.
- **Batch**: pode mandar 50 notas num clip numa única chamada.
- **Bi-direcional**: listeners viram eventos JSON-RPC notification.

OSC fica disponível como **transport alternativo** para quem já roda AbletonOSC (`ABLETON_MIND_TRANSPORT=osc`).

### 3.3 Layout de arquivos

Espelhando `tdmcp/src/`:

```
ableton-mind/
├─ src/
│  ├─ index.ts                    # entry MCP server
│  ├─ server/                     # MCP plumbing (tools, resources, prompts)
│  ├─ live-client/                # cliente TCP/OSC → bridge
│  ├─ tools/                      # ~150 MCP tools agrupadas por domínio
│  │  ├─ transport.ts             #   play/stop/tempo/quantization
│  │  ├─ track.ts                 #   create/delete/mixer/routing
│  │  ├─ clip.ts                  #   MIDI clips, notas, audio clips, warping
│  │  ├─ scene.ts
│  │  ├─ device.ts                #   built-in + VST/AU + M4L
│  │  ├─ rack.ts                  #   drum/instrument/audio/MIDI racks, chains
│  │  ├─ automation.ts            #   envelopes em arrangement + session
│  │  ├─ modulation.ts            #   macros, MIDI/key map, modulators M4L
│  │  ├─ browser.ts               #   navega library, busca devices/samples
│  │  ├─ arrangement.ts           #   timeline ops, regions, locators, fades
│  │  ├─ recording.ts             #   session record, capture MIDI, arrange rec
│  │  ├─ mixer.ts                 #   sends, returns, master, crossfader, EQ
│  │  ├─ view.ts                  #   session/arrangement, detail, highlights
│  │  ├─ session.ts               #   load/save .als, export audio, freeze
│  │  ├─ groove.ts                #   groove pool, time signature, swing
│  │  ├─ midi.ts                  #   MIDI mapping, key mapping, CC learn
│  │  ├─ push.ts                  #   Push 1/2/3 LEDs, pads, modos
│  │  └─ introspection.ts         #   estado total, snapshot, diff
│  ├─ knowledge/
│  │  ├─ devices/                 #   esquema por device (wavetable.json, etc)
│  │  ├─ packs/                   #   índices dos packs oficiais
│  │  ├─ scales.json              #   modos, escalas, root notes
│  │  ├─ grooves.json             #   grooves do Live
│  │  └─ midi.json                #   ranges, CC standards
│  ├─ recipes/
│  │  ├─ drums/                   #   tech-house-kick.json, dnb-break.json…
│  │  ├─ bass/                    #   reese.json, sub-808.json…
│  │  ├─ chords/                  #   neo-soul-progressions.json…
│  │  ├─ racks/                   #   sidechain-rack.json, parallel-comp.json…
│  │  ├─ arrangements/            #   tech-house-7-min.json…
│  │  └─ mixing/                  #   master-bus.json, vocal-chain.json…
│  ├─ feedback/                   #   verify loop: lê estado, compara, diff
│  ├─ prompts/                    #   templates para o assistente
│  ├─ resources/                  #   MCP resources (estado vivo da sessão)
│  ├─ integrations/
│  │  ├─ abletonosc/              #   transport OSC opcional
│  │  ├─ push/                    #   Push device protocol
│  │  └─ move/                    #   Ableton Move sync
│  ├─ cli/
│  │  ├─ agent.ts                 #   ableton-mind-agent (copilot local)
│  │  └─ doctor.ts                #   ableton-mind doctor (diagnóstico)
│  └─ utils/
├─ live/                          # Remote Script Python (instala em Ableton/User Library/Remote Scripts)
│  ├─ __init__.py
│  ├─ AbletonMind/
│  │  ├─ __init__.py              # entrypoint (class AbletonMind(ControlSurface))
│  │  ├─ bridge.py                # TCP server + JSON-RPC dispatch
│  │  ├─ handlers/                # um arquivo por domínio (transport, track, …)
│  │  ├─ listeners.py             # subscriptions LiveAPI
│  │  ├─ transactions.py          # begin/end_undo_step wrappers
│  │  └─ schemas.py               # dataclasses de I/O
│  └─ tests/                      # unittest do bridge
├─ docs/                          # VitePress, PT-BR + EN (igual tdmcp)
├─ recipes/                       # cópia distribuída em runtime
├─ dxt/                           # manifest p/ Claude Desktop .mcpb
├─ scripts/
├─ tests/
├─ package.json
├─ tsconfig.json
├─ biome.json
├─ Dockerfile
├─ CLAUDE.md
├─ AGENTS.md
└─ README.md (PT-BR + EN)
```

---

## 4. Mapa de features — o que vai estar coberto

Agrupado por domínio LOM. Marcação: **✅** = no ableton-mcp (ahujasid), **🟡** = no AbletonOSC, **🆕** = só no ableton-mind.

### 4.1 Transport & Song
- ✅🟡 Play / Stop / Continue
- 🟡 Tap tempo, undo, redo, capture MIDI, session record arm
- ✅🟡 Set/get tempo
- 🟡 Time signature (numerator, denominator)
- 🟡 Metronome on/off
- 🟡 Loop (start, length, on/off)
- 🟡 Clip trigger quantization (Global/None/8 Bars…1/32)
- 🟡 MIDI recording quantization
- 🟡 Groove amount (global)
- 🟡 Punch in/out
- 🟡 Cue points (add, delete, rename, jump)
- 🟡 Current song time (read/set)
- 🟡 Root note, scale name
- 🆕 Begin/end undo step (transação)
- 🆕 Save / save as / new set
- 🆕 Export audio (range, format, normalization)
- 🆕 Freeze / flatten track
- 🆕 Tempo automation envelope no master
- 🆕 Listen: is_playing, song_time, beat (com push assíncrono)

### 4.2 Track (audio, MIDI, return, master, group)
- ✅🟡 Create audio/MIDI track (com index)
- 🟡 Create return track
- 🟡 Delete track / delete return track
- 🟡 Duplicate track
- ✅🟡 Set/get name, color, color_index
- 🟡 Mute, solo, arm
- 🟡 Volume, panning, sends
- 🟡 Output meter (left, right, level)
- 🟡 Input routing (type, channel, sub-channel)
- 🟡 Output routing (type, channel, sub-channel)
- 🟡 Monitoring state (In/Auto/Off)
- 🟡 Group fold/unfold, is_foldable, is_grouped
- 🟡 Available routing types/channels (descobre antes de setar)
- 🟡 Stop all clips on track
- 🆕 Group / ungroup tracks (criar group track e mover children)
- 🆕 Move track (reorder)
- 🆕 Master track ops (volume, EQ, devices, fader curve)
- 🆕 Crossfader assign (A/B/Off)
- 🆕 Take lanes (Live 11+): listar, criar, comprimir
- 🆕 Track delay (input/output)
- 🆕 Track meta: time-stretched bytes, total CPU usage
- 🆕 Listen: meter level (VU em tempo real → permite assistente reagir a peak)

### 4.3 Clip — MIDI
- ✅🟡 Create empty MIDI clip (track, slot, length)
- ✅🟡 Add notes (batch: pitch, start, duration, velocity, mute)
- 🟡 Get notes (filtro por pitch range + time range)
- 🟡 Remove notes (filtro idem)
- 🟡 Loop start/end, position, start_marker, end_marker
- 🟡 Launch mode (Trigger/Gate/Toggle/Repeat)
- 🟡 Launch quantization (Global / None / 8 Bars … 1/32)
- 🟡 Legato, has_groove, velocity_amount
- 🟡 Name, color, color_index, muted
- 🆕 **MPE expression** por nota: pitch bend per-note, pressure, slide
- 🆕 **Probability** por nota (Live 11+)
- 🆕 **Release velocity** por nota
- 🆕 Note groove value
- 🆕 Apply scale (force notes to scale)
- 🆕 Quantize notes (amount, swing, target grid)
- 🆕 Humanize (random velocity/timing within range)
- 🆕 Reverse / invert / transpose
- 🆕 Generate from recipe (drum pattern, arpeggio, chord prog)
- 🆕 Convert audio to MIDI (harmony/melody/drums) — usa o Live nativo
- 🆕 Listen: playing_position (cabeçote do clip)

### 4.4 Clip — Audio
- ✅🟡 Insert audio file in slot (path)
- 🟡 Warping on/off, warp mode (Beats/Tones/Texture/Re-Pitch/Complex/Pro)
- 🟡 Gain, pitch coarse, pitch fine
- 🟡 Ram mode
- 🟡 Sample length, file_path
- 🟡 Loop start/end, start/end marker
- 🆕 **Warp markers**: get/add/move/delete (lista completa de markers de tempo)
- 🆕 Detect transients (rebuild)
- 🆕 Set BPM master clip (auto-warp para tempo da sessão)
- 🆕 Slice to MIDI (Simpler/Drum Rack)
- 🆕 Reverse audio clip
- 🆕 Fade in/out (Arrangement)
- 🆕 Crossfade entre clips adjacentes

### 4.5 Clip slot (Session View)
- 🟡 Fire / stop
- 🟡 Has clip, has_stop_button
- 🟡 Create empty clip (length)
- 🟡 Delete clip
- 🟡 Duplicate clip para outro slot
- 🆕 Copiar slot para Arrangement (com posição)
- 🆕 Bulk operations: fire scene por filtro (todas com tag X)

### 4.6 Scene
- 🟡 Fire / fire_as_selected
- 🟡 Create / delete / duplicate (por index)
- 🟡 Name, color, color_index, is_empty, is_triggered
- 🟡 Tempo + tempo_enabled
- 🟡 Time signature + enabled
- 🆕 Capture scene from playing clips (igual atalho)
- 🆕 Mover scene (reorder)

### 4.7 Device (built-in + VST/AU + M4L)
- ✅🟡 Load device by URI (browser path)
- 🟡 Get name, class_name, type (instrument/audio_effect/midi_effect)
- 🟡 Num parameters
- 🟡 Get parameters: name/value/min/max/is_quantized + value_string
- 🟡 Set parameter value (single + batch)
- 🟡 Listen: parameter value
- 🆕 Delete device (track_id, device_index)
- 🆕 Move device (reorder dentro da chain)
- 🆕 Copy device entre tracks
- 🆕 Toggle on/off (bypass)
- 🆕 Get device preset list + load preset
- 🆕 Save device as preset (.adv)
- 🆕 **Schema-aware set**: "set device Wavetable Osc 1 Position to 0.7" — resolve nome do parâmetro via knowledge base, sem precisar saber index
- 🆕 Mapeamento de devices nativos completos (Wavetable, Operator, Drift, Meld, Bass, Sampler, Simpler, Drum Sampler, EQ Eight, Glue Compressor, Drum Buss, Multiband Dynamics, Spectral Resonator, Roar, etc.)
- 🆕 Sidechain config (kick→bass): roteia source + ativa sidechain no compressor
- 🆕 M4L device: descobrir todos os Live API objects expostos
- 🆕 Plugin VST/AU: detectar (vendor, name, version), abrir UI, listar parâmetros expostos
- 🆕 External Instrument / External Audio Effect setup

### 4.8 Racks (Instrument, Drum, Audio, MIDI Effect)
- 🆕 Create rack (any type)
- 🆕 Get chains (chain index, name, solo, mute, volume, pan, send)
- 🆕 Add chain / delete chain
- 🆕 Map chain key range / velocity range (zonas)
- 🆕 Set chain devices
- 🆕 Drum rack: get/set pads (note 36-99), pad chains, pad device
- 🆕 Drum rack: load sample para pad (path)
- 🆕 Drum rack: choke groups
- 🆕 Macros (1-16 em Live 12): name, value, get/set, randomize
- 🆕 Macro variations (Live 12): list, snap, recall
- 🆕 Mapeamento parameter → macro (com curve, min/max range, invert)
- 🆕 Listen: chain solo/mute, macro value

### 4.9 Automation (Arrangement & Session)
- 🆕 List automation lanes em uma track
- 🆕 Get envelope para `(track, device, parameter)` em arrangement
- 🆕 Add/remove/edit pontos do envelope (time, value, curve)
- 🆕 Clear automation
- 🆕 Re-enable automation
- 🆕 Clip envelopes (session): mesmo, mas no clipe
- 🆕 Automation modes (Latch/Touch/Read/Write)
- 🆕 Bulk: "criar fade in de filter cutoff de 0 a 1 ao longo de 8 bars"
- 🆕 Listen: automation playback values

### 4.10 Modulation (Modulators M4L do Live 12)
- 🆕 List modulation sources (LFO, Envelope Follower, Shaper, Random)
- 🆕 Map source → target parameter
- 🆕 Set modulation depth, polarity, rate
- 🆕 List active modulations

### 4.11 Browser & Library
- ✅🟡 Get browser tree (categoria: instruments, drums, audio_effects, etc)
- ✅🟡 Get items at path
- 🆕 Search by name (fuzzy)
- 🆕 Filter by tag (Sounds/Drums/Bass, etc.)
- 🆕 Filter by pack
- 🆕 Identificar packs instalados + versão
- 🆕 Knowledge base de packs oficiais (Beat Tools, Skitter & Step, Drive & Glow, etc.) e seus conteúdos
- 🆕 Resolve URI ambíguo ("808 kick" → top match com score)
- 🆕 User Library navegação
- 🆕 Recently used devices/samples

### 4.12 Arrangement View
- 🟡 Get arrangement clips (track) — names, lengths, start_times
- ✅🟡 Duplicate session clip → arrangement (track, slot, destino)
- 🆕 Place clip no arrangement (qualquer track + posição)
- 🆕 Move clip
- 🆕 Resize / loop clip in arrangement
- 🆕 Delete arrangement clip
- 🆕 Locators (add, rename, jump, delete)
- 🆕 Time selection (start, end)
- 🆕 Loop region
- 🆕 Cut/copy/paste time
- 🆕 Insert silence
- 🆕 Consolidate (audio + MIDI)
- 🆕 Crop sample / clip
- 🆕 Tempo automation (master)

### 4.13 Mixer
- 🟡 Volume, pan, sends, solo, mute, arm (já em Track)
- 🆕 Send count + criação de novo return
- 🆕 Master volume, master pan
- 🆕 Crossfader value + curve
- 🆕 Cue volume / Cue out routing (DJ booth)
- 🆕 Channel EQ rápido (high/mid/low) sem precisar carregar EQ Three
- 🆕 Pre/post fader send mode

### 4.14 Recording
- 🟡 Session record on/off
- 🟡 Capture MIDI
- 🟡 Punch in/out
- 🆕 Arrangement record arm + start
- 🆕 Quantize on recording amount
- 🆕 Count-in
- 🆕 Record overdub (Arrangement)
- 🆕 Take lane recording (Live 11+)

### 4.15 View / UX
- 🟡 Selected track / scene / clip / device (get/set)
- 🟡 Show message no statusbar
- ✅🟡 Switch session/arrangement view
- 🆕 Show detail view (clip/device)
- 🆕 Highlight track/clip (selecionar + scroll)
- 🆕 Close all device UIs
- 🆕 Toggle browser
- 🆕 Toggle Hot Swap

### 4.16 MIDI mapping / Remote control / Key map
- 🟡 Map CC → parâmetro (channel, cc, track_id, device_id, param_id)
- 🆕 Unmap CC
- 🆕 Map Note → parâmetro
- 🆕 Key mapping (teclado computador → função)
- 🆕 List all MIDI mappings
- 🆕 Map relative / absolute / takeover mode
- 🆕 MIDI sync (in/out, send clock, song position)

### 4.17 Grooves
- 🆕 Groove pool: listar grooves carregados
- 🆕 Carregar groove (.agr) da library
- 🆕 Aplicar groove a clip
- 🆕 Set groove amount no clip + global

### 4.18 Push & Move
- 🆕 Push 1/2/3: pads, encoders, LEDs, modos
- 🆕 Push 3 Standalone: enviar set, sync via Move
- 🆕 Move: listar sets, transferir set, controlar transport remoto

### 4.19 Max for Live (M4L)
- 🆕 Detectar devices M4L em qualquer track
- 🆕 Get exposed parameters (live.numbox, live.dial)
- 🆕 Get device patcher metadata (devices internos para introspection)
- 🆕 Carregar device M4L de path
- 🆕 Acionar functions exposed via M4L API (hello-message)

### 4.20 Session-level introspection (resources MCP)
- 🆕 `live://session/state` — snapshot completo (todas tracks, devices, params, clips, scenes)
- 🆕 `live://session/timeline` — arrangement como JSON
- 🆕 `live://session/mixer` — mixer state
- 🆕 `live://browser/tree` — browser tree
- 🆕 `live://devices/catalog` — knowledge base de devices nativos
- 🆕 `live://recipes/index` — lista de recipes disponíveis

### 4.21 Reatividade (listeners → MCP notifications)
- 🆕 Subscribe a property changes (tempo, is_playing, selected_clip, etc.)
- 🆕 Subscribe a beat tick (cada batida)
- 🆕 Subscribe a meter level (VU)
- 🆕 Subscribe a parameter changes (automation playback)
- 🆕 Server emite como MCP `notification/progress` ou via Server-Sent resource updates

---

## 5. Knowledge base embarcada

Para o LLM **parar de chutar parâmetros**. Inspirado no que o tdmcp faz com os 629 operadores TouchDesigner.

### 5.1 Devices nativos (`src/knowledge/devices/`)

Um JSON por device, com schema completo de parâmetros. Exemplo:

```json
// wavetable.json
{
  "uri": "Live:Instruments:Wavetable",
  "type": "instrument",
  "category": "synthesizer",
  "polyphony": "up to 16",
  "parameters": [
    {
      "index": 0,
      "name": "Osc 1 Position",
      "min": 0.0, "max": 1.0, "default": 0.0,
      "unit": "normalized",
      "description": "Position within the wavetable for oscillator 1",
      "automation": true, "modulation": true
    },
    {
      "index": 1,
      "name": "Osc 1 Effect 1",
      "min": 0.0, "max": 1.0, "default": 0.0,
      "depends_on": "Osc 1 Mode"
    }
    // ... ~150 parâmetros
  ],
  "presets": ["Bass Wobble", "Lead Square", "Pad Ethereal", ...],
  "macro_targets": ["Filter Cutoff", "Osc 1 Position", "Sub Volume"]
}
```

**Devices cobertos** (Live 12 nativos):

- **Instruments**: Wavetable, Operator, Drift, Meld, Bass, Sampler, Simpler, Drum Sampler, Drum Rack, Instrument Rack, Impulse, Tension, Collision, Electric, Analog, External Instrument
- **MIDI Effects**: Arpeggiator, Chord, Note Length, Pitch, Random, Scale, Velocity, MPE Control, MIDI Monitor
- **Audio Effects**: EQ Eight, EQ Three, Glue Compressor, Compressor, Multiband Dynamics, Limiter, Gate, Drum Buss, Saturator, Roar, Pedal, Amp, Cabinet, Reverb, Hybrid Reverb, Echo, Delay, Filter Delay, Grain Delay, Auto Filter, Auto Pan, Frequency Shifter, Phaser-Flanger, Chorus-Ensemble, Vinyl Distortion, Erosion, Redux, Beat Repeat, Looper, Tuner, Spectrum, Spectral Resonator, Spectral Time, Channel EQ, Utility, Gated Delay, Shifter, Vocoder, Corpus
- **Max for Live nativos**: LFO, Envelope Follower, Shaper, Expression Control, etc.

### 5.2 Packs oficiais (`src/knowledge/packs/`)

Índice dos packs Ableton + Cycling '74. Para cada pack: nome, categoria, devices/samples principais, URIs. Permite "carregue um kick de techno do pack X".

### 5.3 Música teórica (`src/knowledge/`)

- `scales.json` — 38 escalas (Major, Minor natural/harmônica/melódica, Dorian, Phrygian, Lydian, Mixolydian, Locrian, Pentatônica major/minor, Blues, Hirajoshi, Ryukyu, Whole tone, Chromatic, etc.) com graus e tensões.
- `chords.json` — voicings comuns por gênero (jazz, pop, neo-soul).
- `grooves.json` — grooves nativos do Live indexados.
- `midi.json` — General MIDI map, CC standards (modulation, expression, sustain), velocity curves.

### 5.4 BPM/gênero/key reference

Faixas usuais de BPM e key por gênero — house 120-128, techno 125-135, D&B 170-180, trap 130-150, etc.

---

## 6. Recipes (`recipes/`)

JSON declarativos que o servidor expande em sequências de tools. Inspirado em `tdmcp/recipes/feedback_network_basic.json`.

Exemplo:

```jsonc
// recipes/drums/tech-house-kit.json
{
  "name": "Tech House Drum Kit",
  "description": "Drum rack pré-configurado: kick punchy, clap analog, hat 909, ride open, perc shaker, sub kick.",
  "tags": ["drums", "tech-house", "house"],
  "tempo_range": [120, 130],
  "steps": [
    { "tool": "create_midi_track", "params": { "index": "$next" } },
    { "tool": "set_track_name", "params": { "name": "Drums" } },
    { "tool": "load_device", "params": { "uri": "Live:Instruments:DrumRack" } },
    { "tool": "drum_rack_load_sample", "params": { 
        "pad": 36, "sample": "Live:Samples:Drums:Kick:HouseKick_01" } },
    { "tool": "drum_rack_load_sample", "params": {
        "pad": 38, "sample": "Live:Samples:Drums:Clap:AnalogClap_03" } },
    // ... mais pads
    { "tool": "load_device", "params": { "uri": "Live:AudioEffects:DrumBuss" } },
    { "tool": "device_set_param", "params": { 
        "device": "$last", "name": "Drive", "value": 0.3 } },
    { "tool": "create_midi_clip", "params": { "slot": 0, "length": 4 } },
    { "tool": "apply_recipe", "params": { "name": "drums/tech-house-pattern" } }
  ]
}
```

**Categorias iniciais de recipes**:

- `drums/` — house, techno, tech-house, D&B (amen, halftime), trap, dembow, hip-hop boom-bap, garage, breaks
- `bass/` — sub 808, reese, acid, rolling tech-house bass, jazz upright, slap bass
- `chords/` — pop pads, jazz extended, neo-soul Rhodes, lo-fi chops, ambient pad layers
- `racks/` — sidechain rack (kick→bus), parallel comp, vocal chain (de-ess + comp + EQ + reverb), mastering chain leve, lo-fi tape
- `arrangements/` — esqueletos de 4/6/8 minutos por gênero (intro/build/drop/breakdown/outro com locators)
- `mixing/` — gain staging starter, master bus, drum bus, vocal bus
- `live_performance/` — Push 3 standalone template, looper setup, DJ deck simulator

---

## 7. Loop create → verify → preview

Mecanismo central que diferencia ableton-mind de wrappers OSC dumb.

```
                ┌────────────┐
                │  LLM gera  │
                └─────┬──────┘
                      │ chama tool (criar track, carregar device…)
                      ▼
              ┌──────────────────┐
              │ ableton-mind     │ executa via bridge
              └─────┬────────────┘
                    │
                    ▼
              ┌──────────────────┐
              │ verify           │ re-lê estado (lista tracks, devices, clips)
              └─────┬────────────┘
                    │  diff vs intenção
                    ▼
                ┌──────────┐  ok? ─► segue
                │ Verdict  │  
                └────┬─────┘  divergência? ─► re-tenta com correção
                     │ (max N tentativas)
                     ▼
              ┌──────────────────┐
              │ preview          │ (opcional, on-demand)
              └─────┬────────────┘
                    │
       ┌────────────┼────────────┐
       ▼            ▼            ▼
  Session JSON  Render áudio  Screenshot UI
   (snapshot)    8 bars WAV   via macOS
```

**Verify** (sempre):
- Após cada batch, lê o estado relevante e compara com schema esperado.
- Detecta: device no slot errado, parâmetro fora do range, clip vazio quando deveria ter notas.
- Tools devolvem `{ ok, verified, diff }` em vez de só `ok`.

**Preview** (opcional, sob demanda):
- `preview_session_state` — JSON enxuto da sessão para o LLM "ver".
- `preview_render` — pede `Song.create_audio_track` temporária + bounce de N bars com `Song.export_audio` (Live 12.1+) ou usa freeze.
- `preview_screenshot` — captura da janela do Live via macOS `screencapture -l <window-id>` (precisa do bridge identificar o pid).
- Retorna como MCP resource (imagem ou áudio) para o LLM consumir.

---

## 8. Superfície MCP — tools, resources, prompts

### 8.1 Tools (~150)

Esboço por domínio (nomes finais TBD; padrão `snake_case`):

| Domínio | Exemplos | Qtd estimada |
|---|---|---|
| Transport | `play`, `stop`, `set_tempo`, `set_time_signature`, `tap_tempo`, `set_metronome`, `set_loop`, `add_cue_point`, `undo`, `redo` | 15 |
| Track | `create_midi_track`, `create_audio_track`, `create_return_track`, `delete_track`, `duplicate_track`, `group_tracks`, `move_track`, `set_track_name`, `set_track_color`, `set_track_mute`, `set_track_solo`, `set_track_arm`, `set_track_volume`, `set_track_pan`, `set_track_send`, `set_input_routing`, `set_output_routing`, `set_monitoring`, `freeze_track`, `flatten_track`, `get_track_info` | 25 |
| Clip (MIDI) | `create_midi_clip`, `delete_clip`, `add_notes`, `replace_notes`, `remove_notes`, `get_notes`, `quantize_clip`, `humanize_clip`, `transpose_clip`, `apply_scale`, `set_clip_loop`, `set_clip_color`, `set_clip_name`, `set_launch_mode`, `set_launch_quantization`, `set_note_probability`, `set_note_mpe` | 20 |
| Clip (audio) | `create_audio_clip`, `set_warp_mode`, `set_warping`, `set_clip_gain`, `set_pitch`, `add_warp_marker`, `move_warp_marker`, `delete_warp_marker`, `slice_to_midi`, `reverse_clip`, `set_clip_fade` | 12 |
| Scene | `create_scene`, `delete_scene`, `duplicate_scene`, `fire_scene`, `capture_scene`, `set_scene_name`, `set_scene_tempo`, `set_scene_time_signature` | 10 |
| Device | `load_device`, `delete_device`, `move_device`, `toggle_device`, `set_device_param`, `set_device_params_batch`, `set_device_param_by_name`, `get_device_info`, `load_preset`, `save_preset`, `sidechain_config` | 15 |
| Rack | `create_rack`, `add_chain`, `delete_chain`, `set_chain_zones`, `set_macro`, `map_param_to_macro`, `unmap_macro`, `drum_pad_load`, `drum_pad_set_choke` | 12 |
| Automation | `list_envelopes`, `add_automation_point`, `clear_automation`, `set_automation_mode`, `bulk_automation_curve`, `disable_automation` | 8 |
| Modulation | `add_modulator`, `map_modulator`, `set_modulator_depth`, `list_modulations` | 5 |
| Browser | `browse`, `search_browser`, `resolve_uri`, `list_packs`, `list_user_library` | 6 |
| Arrangement | `place_clip`, `move_clip`, `delete_arrangement_clip`, `resize_clip`, `add_locator`, `set_time_selection`, `consolidate`, `crop`, `insert_silence`, `set_tempo_automation` | 12 |
| Mixer | `set_master_volume`, `set_crossfader`, `set_cue_volume`, `set_channel_eq`, `set_send_pre_post` | 6 |
| Recording | `arm_session_record`, `start_arrangement_record`, `set_count_in`, `set_record_quantize`, `take_lane_op` | 6 |
| View | `select_track`, `select_clip`, `select_scene`, `select_device`, `show_session_view`, `show_arrangement_view`, `show_detail`, `show_message`, `close_all_uis` | 9 |
| MIDI map | `map_cc`, `map_note`, `map_key`, `unmap`, `list_mappings` | 5 |
| Groove | `load_groove`, `apply_groove`, `set_global_groove` | 3 |
| Push/Move | `push_set_mode`, `push_set_pad_color`, `move_transfer_set` | ~5 |
| Recipes | `list_recipes`, `apply_recipe`, `apply_recipe_with_overrides` | 3 |
| Introspection | `get_session_snapshot`, `get_track_snapshot`, `diff_session` | 3 |
| Preview | `render_preview`, `screenshot_live` | 2 |
| **Total** | | **~180** |

### 8.2 Resources MCP

- `live://session/state` (live snapshot, atualiza a cada N segundos)
- `live://session/timeline` (arrangement clips em JSON)
- `live://browser/tree` (cached, invalidado por evento)
- `live://devices/catalog` (knowledge base)
- `live://recipes/index`
- `live://transport/now` (push de tempo, beat, is_playing — server-side updates)

### 8.3 Prompts MCP (templates)

- `compose_track` — "componha um track no estilo X com Y bars"
- `mix_balance` — "balance os níveis das tracks"
- `arrange_session` — "estenda essa loop em arrangement completo"
- `sound_design` — "crie um patch de Wavetable estilo X"
- `mastering_chain` — "monte uma cadeia de mastering leve"

---

## 9. Transport / instalação / distribuição

Igual ao tdmcp:

| Canal | Pacote | Quem usa |
|---|---|---|
| Claude Desktop | `.mcpb` (Claude Desktop Bundle, ex-`.dxt`) | Usuário não-técnico, 1 clique |
| Claude Code / Cursor / Codex | npm `@dpantani/ableton-mind` | Devs |
| Smithery | hosted | Multi-cliente cloud |
| Docker | container | CI / sandboxes |
| GitHub release | binário direto | Air-gapped |

**Remote Script** instala em:

- macOS: `~/Music/Ableton/User Library/Remote Scripts/AbletonMind/`
- Windows: `~/Documents/Ableton/User Library/Remote Scripts/AbletonMind/`

Script setup (`ableton-mind setup`) cria symlink/cópia + abre o Live para ativar em Preferences → Link/Tempo/MIDI → Control Surface.

---

## 10. CLI complementar (`ableton-mind-agent`, `ableton-mind doctor`)

Espelhando `tdmcp-agent`:

- `ableton-mind doctor` — checa: Live rodando? Remote Script ativado? Porta livre? Versão do Live ≥ 11? Python dentro do Live OK?
- `ableton-mind agent` — REPL local que usa a knowledge base + recipes sem precisar de Claude (suporte OpenAI/Anthropic key opcional).
- `ableton-mind probe` — descobre Live aberto e dumpa snapshot.

---

## 11. Riscos & limitações conhecidos

| Risco | Mitigação |
|---|---|
| Remote Scripts rodam single-threaded no thread de áudio. Operações longas (carregar pack 5GB) bloqueiam. | Bridge faz tudo via `Live.Application.get_application().get_document().schedule(...)` quando possível; tools longas marcadas como `async` no MCP com progress. |
| Live 12 mudou Python para 3.11 — Live 10/11 usa 3.7. | Bridge mantém compatibilidade 3.7+ ou flag de "live12-only". Recomendar Live 11+. |
| Plugins VST/AU expõem só params automáveis (até 128 em VST2). | Limite documentado, fallback: usa preset.fxp/.aupreset. |
| Audio render via `Song.export_audio` só na Live 12.1+. | Para versões anteriores, usa freeze track + read frozen file. |
| Push 3 standalone via WiFi tem latência. | Move sync recomendado para transferências. |
| Carregar device via URI muda entre versões/packs. | Knowledge base tem URIs versionadas; `resolve_uri` faz fuzzy match. |
| AbletonOSC e ableton-mind brigando pela mesma porta. | Detecta na startup, oferece migração. |
| MCP protocol limites de payload — sessão com 200 tracks gera resource gigante. | Resource paginado: `live://session/state?tracks=10-20`. |

---

## 12. Roadmap por fases

### Fase 0 — Spike (1-2 semanas)
- Repo scaffold copiando `tdmcp` (TS+Node, tsup, biome, vitest, MCP SDK).
- Bridge Python mínimo: TCP server, dispatch JSON-RPC, 5 handlers (play, stop, tempo, list tracks, create midi clip).
- Cliente TS no servidor MCP.
- 1 tool MCP: `play` end-to-end.
- Doc `docs/architecture.md`.

### Fase 1 — Paridade com ahujasid (2-3 semanas)
- 22 tools do ahujasid funcionando + verify loop.
- Transações com undo unitário.
- Browser tree.
- Smoke tests rodando Live de verdade no CI (macOS runner).

### Fase 2 — Paridade com AbletonOSC (3-4 semanas)
- Todos os getters/setters/methods do LOM (Song, Track, Clip Slot, Clip, Scene, Device, View).
- Listeners → MCP notifications.
- Resource `live://session/state`.

### Fase 3 — Knowledge & Recipes (3-4 semanas)
- Schemas dos 50+ devices nativos.
- 30 recipes (drums, bass, chords, racks, mixing).
- Tool `set_device_param_by_name` resolvendo via knowledge.
- Tool `apply_recipe`.

### Fase 4 — Coberturas avançadas (4-6 semanas)
- Automation completo (arrangement + clip envelopes).
- Modulation (Live 12).
- Racks profundos (drum, instrument, audio, MIDI).
- MPE per-note, probability.
- Warp markers granular.
- Take lanes.

### Fase 5 — Preview & Feedback (2-3 semanas)
- `render_preview` (8-bar bounce).
- `screenshot_live` (macOS + Windows).
- Session diff (snapshot anterior vs atual).

### Fase 6 — Push & Move (3-4 semanas)
- Push 1/2/3 LEDs/pads/modos.
- Move sync.

### Fase 7 — Distribuição & Docs (2-3 semanas)
- `.mcpb` (Claude Desktop).
- Smithery listing.
- Docker.
- Docs VitePress PT-BR + EN.
- Prompt cookbook.
- Recipe gallery com áudio renderizado.

### Fase 8 — Long tail
- Max for Live patcher introspection.
- VST3 sidecar (params expandidos).
- Integração com DAW remoto (Live Link).
- Mobile Push companion.

**Total estimado**: ~6 meses de uma pessoa em tempo integral para chegar a v1.0 sólido (Fases 0-5). Fases 6-8 são roadmap pós-1.0.

---

## 13. Decisões abertas (precisa input antes de começar)

| Pergunta | Opções | Recomendação inicial |
|---|---|---|
| Linguagem do MCP server | TypeScript (= tdmcp), Python (= ahujasid) | **TypeScript** — coerência com tdmcp, ecossistema MCP melhor em TS, melhor tooling Zod. |
| Transport bridge↔server | TCP socket JSON-RPC, WebSocket, OSC | **TCP JSON-RPC** principal + OSC opcional. |
| Versão mínima do Live | 10, 11, 12 | **Live 11** — corta poucos usuários, ganha take lanes / MPE / probability. |
| Suporte AbletonOSC | Drop-in replace ou coexistir? | **Coexistir** — flag para usar OSC como transport. |
| Nome final | `ableton-mind`, `abletonmcp`, `livemcp`, outro | **ableton-mind** já é o diretório. Bom nome (espelha tdmcp como "mind designer"). |
| Licença | MIT (= tdmcp), AGPL, Apache 2.0 | **MIT** — alinhado com tdmcp. |
| Suporte Windows | desde dia 1 ou Mac primeiro | **Mac primeiro** (Live é mais usado em Mac, dev mais rápido), Windows na Fase 1. |
| Knowledge devices: scrape ou manual | Live tem `Default.adv` em XML, dá pra extrair; ou manual com docs Ableton | **Híbrido** — script `scripts/extract-device-schemas.mjs` pega base, manual completa. |
| Renderização preview | Bounce real (lento) ou simulação MIDI/áudio (rápido, imperfeito) | **Bounce real** opt-in, default = snapshot JSON. |

---

## 14. Comparativo final

| Capacidade | ahujasid/ableton-mcp | AbletonOSC + wrapper MCP | **ableton-mind** |
|---|---|---|---|
| Tools MCP | 22 | ~30 (wrapper raso) | **~180** |
| Cobertura LOM | ~10% | ~95% | **~100%** |
| Knowledge base | nenhuma | nenhuma | **50+ devices, scales, packs, grooves** |
| Recipes | nenhuma | nenhuma | **30+ na v1, extensível** |
| Verify loop | não | não | **sim, integrado** |
| Preview (render/screenshot) | não | não | **sim** |
| Listeners reativos | não | sim (OSC) | **sim (MCP notifications)** |
| Transações (undo unitário) | não | não | **sim** |
| Automation envelopes | não | parcial | **completo** |
| Racks profundos | drum só (load) | leitura básica | **completo CRUD** |
| Modulation (Live 12) | não | parcial | **completo** |
| Push / Move | não | não | **sim** |
| Docs PT-BR | não | não | **sim** |
| DXT/MCPB 1-click | não | não | **sim** |
| CLI + doctor | não | não | **sim** |

---

## 15. Próximos passos sugeridos

1. **Validar este plano** — você revisa, ajusta escopo (cortar Push/Move? cortar preview? incluir Live 10?).
2. **Decidir as questões abertas** da seção 13 (principalmente: TS confirmado? Live 11+ confirmado?).
3. **Spike Fase 0** — eu posso já começar a scaffoldar o repo copiando estrutura do tdmcp adaptada para Ableton, com 1 tool funcionando ponta a ponta (`play` / `stop` / `set_tempo`).
4. **Inventário de packs** — você lista quais packs Ableton você tem instalado para eu priorizar URIs no knowledge base.
5. **Recipes seed** — você lista os 5-10 gêneros/padrões que mais te interessam (techno? D&B? lo-fi? jazz?) pra eu começar pelos recipes que você vai usar.

---

*Documento de planejamento — ableton-mind v0.0.1-plan.*
