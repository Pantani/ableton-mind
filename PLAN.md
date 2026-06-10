# ableton-mind — Plan for the definitive MCP for Ableton Live

> "Create a tech house at 128 BPM with a four-on-the-floor kick, rolling bass, off-beat hats, vocal chop with sidechain, and a filter opening on the drop."
>
> …and the set appears ready inside Live: tracks, devices, clips, automation, mixer, racks. Playing.

Planning document for **ableton-mind**: an MCP (Model Context Protocol) server for Ableton Live following the same pattern as `tdmcp` (TouchDesigner). Goal: be **the** Ableton MCP, so that nobody needs to write another one.

---

## 1. Why another Ableton MCP

There are already two projects in this space, and neither comes close to "definitive":

| Project | What it is | Main limitation |
|---|---|---|
| [`ahujasid/ableton-mcp`](https://github.com/ahujasid/ableton-mcp) | MCP server + Remote Script (TCP socket, JSON). 22 tools. | Covers only basic creation of tracks/clips/MIDI. No automation, return/master, racks, modulation, recording, undo, routing, listeners, warping, navigable browser, Push, Max for Live. |
| [`ideoforms/AbletonOSC`](https://github.com/ideoforms/AbletonOSC) | Remote Script that exposes ~95% of the LOM via OSC (ports 11000/11001). | Not MCP. No knowledge base. No recipes. No feedback loop. Existing MCP wrapper (`nozomi-koborinai/ableton-osc-mcp`) is thin. |

**What is missing in the market** (and what ableton-mind will deliver):

1. **Total LOM coverage** — every object, property, method, and listener of the Live Object Model 12.x, not a subset.
2. **Embedded knowledge base** — all native Live devices (Wavetable, Operator, Drift, Meld, Bass, Drum Sampler, Simpler, Sampler, every audio effect, MIDI effects), parameters, ranges, defaults, official packs, Max for Live API. The LLM stops guessing.
3. **Music recipes** — a library of ready-made patterns as JSON: drum patterns by genre, basslines, progressions, arrangements, drum racks, mixing presets. The equivalent of tdmcp's "recipes" (`feedback_network_basic.json`, `particle_galaxy.json`).
4. **create → verify → preview loop** — after generating, read state back, validate (does the track have the right device? does the clip have the right notes?), and offer preview (partial render, Session View screenshot, 8-bar audio bounce).
5. **Reactive listeners** — the assistant can "listen" to Live (current beat, playing clip, parameter changing) to generate content in real time in sync.
6. **Push & Move** — integration with Push 3 and Move (Ableton controllers), including standalone mode.
7. **tdmcp pattern** — TS/Node MCP server + Python bridge in Live, DXT/MCPB for Claude Desktop, npm/Smithery/Docker, CI, English root docs plus `docs/pt` localization.

---

## 2. Design principles

| Principle | What it means in practice |
|---|---|
| **Total LOM coverage** | No "ah, you can't do that". If Max for Live can, ableton-mind can. |
| **Idempotency** | `create_midi_track {index: 3, name: "Bass"}` called twice does not create 2 tracks. Tools check state before mutating. |
| **Transactions** | Composite operations (create track + load device + play clip) are atomic with a unitary undo. Uses `Song.begin_undo_step()` / `end_undo_step()`. |
| **Reversibility** | Every destructive tool (delete_track, remove_notes) snapshots before acting. `undo_last_operation` rolls everything back. |
| **Read-before-write** | Before generating, read. Know that Track 3 exists, know it is MIDI, know which devices it has. |
| **Recipes > Prompts** | For repetitive patterns (techno drum kit, D&B bass), JSON recipes beat 200-line prompts. |
| **Knowledge > Guessing** | Every device has its schema embedded. The LLM never needs to guess that Wavetable has `Osc 1 Position`. |
| **No heavy external dependencies** | Works with native Live. AbletonOSC will come as **optional** for users who already have it. |

---

## 3. Architecture

Three pieces talking locally, in the same pattern as tdmcp:

```
   You + AI                ableton-mind                Ableton Live
  (Claude/Cursor)    ─▶  (TS/Node MCP server)   ─▶  (Python Remote Script)
   "techno 128 BPM,                                     creates tracks, devices,
    kick + bass + pad"                                  clips, automation
```

### 3.1 Layers

| Layer | Stack | Responsibility |
|---|---|---|
| **MCP Server** | TypeScript + Node 20+, official MCP SDK (`@modelcontextprotocol/sdk`) | Exposes tools/resources/prompts. Validates input with Zod. Routes to the bridge. Loads knowledge base + recipes. |
| **Bridge** (Remote Script) | Python 3 inside Live (Live uses Python 3.11 since 12.x) | Runs inside Live as a MIDI Remote Script. Local TCP server (port 9876 by default, configurable). Receives JSON-RPC, executes via LiveAPI, returns state. |
| **Knowledge** | Static JSON + Markdown embedded in the package | Device schemas, packs, MIDI ranges, scales, groove scales, drum kit mappings. |

### 3.2 bridge ↔ server protocol

JSON-RPC 2.0 over a local TCP socket. Short, idempotent messages:

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

Why JSON-RPC instead of native OSC:
- **Typed**: uses Zod on the TS side, dataclasses on the Python side.
- **Structured errors**: AbletonOSC only replies with "/live/error msg" — frustrating to debug.
- **Batch**: can send 50 notes into a clip in a single call.
- **Bidirectional**: listeners become JSON-RPC notification events.

OSC remains available as an **alternative transport** for users already running AbletonOSC (`ABLETON_MIND_TRANSPORT=osc`).

### 3.3 File layout

Mirroring `tdmcp/src/`:

```
ableton-mind/
├─ src/
│  ├─ index.ts                    # MCP server entry
│  ├─ server/                     # MCP plumbing (tools, resources, prompts)
│  ├─ live-client/                # TCP/OSC client → bridge
│  ├─ tools/                      # ~150 MCP tools grouped by domain
│  │  ├─ transport.ts             #   play/stop/tempo/quantization
│  │  ├─ track.ts                 #   create/delete/mixer/routing
│  │  ├─ clip.ts                  #   MIDI clips, notes, audio clips, warping
│  │  ├─ scene.ts
│  │  ├─ device.ts                #   built-in + VST/AU + M4L
│  │  ├─ rack.ts                  #   drum/instrument/audio/MIDI racks, chains
│  │  ├─ automation.ts            #   envelopes in arrangement + session
│  │  ├─ modulation.ts            #   macros, MIDI/key map, M4L modulators
│  │  ├─ browser.ts               #   browse library, search devices/samples
│  │  ├─ arrangement.ts           #   timeline ops, regions, locators, fades
│  │  ├─ recording.ts             #   session record, capture MIDI, arrange rec
│  │  ├─ mixer.ts                 #   sends, returns, master, crossfader, EQ
│  │  ├─ view.ts                  #   session/arrangement, detail, highlights
│  │  ├─ session.ts               #   load/save .als, export audio, freeze
│  │  ├─ groove.ts                #   groove pool, time signature, swing
│  │  ├─ midi.ts                  #   MIDI mapping, key mapping, CC learn
│  │  ├─ push.ts                  #   Push 1/2/3 LEDs, pads, modes
│  │  └─ introspection.ts         #   total state, snapshot, diff
│  ├─ knowledge/
│  │  ├─ devices/                 #   per-device schema (wavetable.json, etc.)
│  │  ├─ packs/                   #   indexes of official packs
│  │  ├─ scales.json              #   modes, scales, root notes
│  │  ├─ grooves.json             #   Live grooves
│  │  └─ midi.json                #   ranges, CC standards
│  ├─ recipes/
│  │  ├─ drums/                   #   tech-house-kick.json, dnb-break.json…
│  │  ├─ bass/                    #   reese.json, sub-808.json…
│  │  ├─ chords/                  #   neo-soul-progressions.json…
│  │  ├─ racks/                   #   sidechain-rack.json, parallel-comp.json…
│  │  ├─ arrangements/            #   tech-house-7-min.json…
│  │  └─ mixing/                  #   master-bus.json, vocal-chain.json…
│  ├─ feedback/                   #   verify loop: read state, compare, diff
│  ├─ prompts/                    #   templates for the assistant
│  ├─ resources/                  #   MCP resources (live session state)
│  ├─ integrations/
│  │  ├─ abletonosc/              #   optional OSC transport
│  │  ├─ push/                    #   Push device protocol
│  │  └─ move/                    #   Ableton Move sync
│  ├─ cli/
│  │  ├─ agent.ts                 #   ableton-mind-agent (local copilot)
│  │  └─ doctor.ts                #   ableton-mind doctor (diagnostics)
│  └─ utils/
├─ live/                          # Python Remote Script (installs in Ableton/User Library/Remote Scripts)
│  ├─ __init__.py
│  ├─ AbletonMind/
│  │  ├─ __init__.py              # entrypoint (class AbletonMind(ControlSurface))
│  │  ├─ bridge.py                # TCP server + JSON-RPC dispatch
│  │  ├─ handlers/                # one file per domain (transport, track, …)
│  │  ├─ listeners.py             # LiveAPI subscriptions
│  │  ├─ transactions.py          # begin/end_undo_step wrappers
│  │  └─ schemas.py               # I/O dataclasses
│  └─ tests/                      # bridge unittests
├─ docs/                          # VitePress English root + docs/pt localization
├─ recipes/                       # runtime-distributed copy
├─ dxt/                           # manifest for Claude Desktop .mcpb
├─ scripts/
├─ tests/
├─ package.json
├─ tsconfig.json
├─ biome.json
├─ Dockerfile
├─ CLAUDE.md
├─ AGENTS.md
└─ README.md (English root)
```

---

## 4. Feature map — what will be covered

Grouped by LOM domain. Markers: **✅** = in ableton-mcp (ahujasid), **🟡** = in AbletonOSC, **🆕** = only in ableton-mind.

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
- 🆕 Begin/end undo step (transaction)
- 🆕 Save / save as / new set
- 🆕 Export audio (range, format, normalization)
- 🆕 Freeze / flatten track
- 🆕 Tempo automation envelope on master
- 🆕 Listen: is_playing, song_time, beat (with async push)

### 4.2 Track (audio, MIDI, return, master, group)
- ✅🟡 Create audio/MIDI track (with index)
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
- 🟡 Available routing types/channels (discover before setting)
- 🟡 Stop all clips on track
- 🆕 Group / ungroup tracks (create group track and move children)
- 🆕 Move track (reorder)
- 🆕 Master track ops (volume, EQ, devices, fader curve)
- 🆕 Crossfader assign (A/B/Off)
- 🆕 Take lanes (Live 11+): list, create, compress
- 🆕 Track delay (input/output)
- 🆕 Track meta: time-stretched bytes, total CPU usage
- 🆕 Listen: meter level (real-time VU → lets the assistant react to peak)

### 4.3 Clip — MIDI
- ✅🟡 Create empty MIDI clip (track, slot, length)
- ✅🟡 Add notes (batch: pitch, start, duration, velocity, mute)
- 🟡 Get notes (filter by pitch range + time range)
- 🟡 Remove notes (same filter)
- 🟡 Loop start/end, position, start_marker, end_marker
- 🟡 Launch mode (Trigger/Gate/Toggle/Repeat)
- 🟡 Launch quantization (Global / None / 8 Bars … 1/32)
- 🟡 Legato, has_groove, velocity_amount
- 🟡 Name, color, color_index, muted
- 🆕 **MPE expression** per note: pitch bend per-note, pressure, slide
- 🆕 **Probability** per note (Live 11+)
- 🆕 **Release velocity** per note
- 🆕 Note groove value
- 🆕 Apply scale (force notes to scale)
- 🆕 Quantize notes (amount, swing, target grid)
- 🆕 Humanize (random velocity/timing within range)
- 🆕 Reverse / invert / transpose
- 🆕 Generate from recipe (drum pattern, arpeggio, chord prog)
- 🆕 Convert audio to MIDI (harmony/melody/drums) — uses Live native
- 🆕 Listen: playing_position (clip playhead)

### 4.4 Clip — Audio
- ✅🟡 Insert audio file in slot (path)
- 🟡 Warping on/off, warp mode (Beats/Tones/Texture/Re-Pitch/Complex/Pro)
- 🟡 Gain, pitch coarse, pitch fine
- 🟡 Ram mode
- 🟡 Sample length, file_path
- 🟡 Loop start/end, start/end marker
- 🆕 **Warp markers**: get/add/move/delete (full list of tempo markers)
- 🆕 Detect transients (rebuild)
- 🆕 Set BPM master clip (auto-warp to session tempo)
- 🆕 Slice to MIDI (Simpler/Drum Rack)
- 🆕 Reverse audio clip
- 🆕 Fade in/out (Arrangement)
- 🆕 Crossfade between adjacent clips

### 4.5 Clip slot (Session View)
- 🟡 Fire / stop
- 🟡 Has clip, has_stop_button
- 🟡 Create empty clip (length)
- 🟡 Delete clip
- 🟡 Duplicate clip to another slot
- 🆕 Copy slot to Arrangement (with position)
- 🆕 Bulk operations: fire scene by filter (all with tag X)

### 4.6 Scene
- 🟡 Fire / fire_as_selected
- 🟡 Create / delete / duplicate (by index)
- 🟡 Name, color, color_index, is_empty, is_triggered
- 🟡 Tempo + tempo_enabled
- 🟡 Time signature + enabled
- 🆕 Capture scene from playing clips (same as the shortcut)
- 🆕 Move scene (reorder)

### 4.7 Device (built-in + VST/AU + M4L)
- ✅🟡 Load device by URI (browser path)
- 🟡 Get name, class_name, type (instrument/audio_effect/midi_effect)
- 🟡 Num parameters
- 🟡 Get parameters: name/value/min/max/is_quantized + value_string
- 🟡 Set parameter value (single + batch)
- 🟡 Listen: parameter value
- 🆕 Delete device (track_id, device_index)
- 🆕 Move device (reorder within the chain)
- 🆕 Copy device between tracks
- 🆕 Toggle on/off (bypass)
- 🆕 Get device preset list + load preset
- 🆕 Save device as preset (.adv)
- 🆕 **Schema-aware set**: "set device Wavetable Osc 1 Position to 0.7" — resolves the parameter name via the knowledge base, no need to know the index
- 🆕 Full mapping of native devices (Wavetable, Operator, Drift, Meld, Bass, Sampler, Simpler, Drum Sampler, EQ Eight, Glue Compressor, Drum Buss, Multiband Dynamics, Spectral Resonator, Roar, etc.)
- 🆕 Sidechain config (kick→bass): routes source + enables sidechain on the compressor
- 🆕 M4L device: discover all exposed Live API objects
- 🆕 VST/AU plugin: detect (vendor, name, version), open UI, list exposed parameters
- 🆕 External Instrument / External Audio Effect setup

### 4.8 Racks (Instrument, Drum, Audio, MIDI Effect)
- 🆕 Create rack (any type)
- 🆕 Get chains (chain index, name, solo, mute, volume, pan, send)
- 🆕 Add chain / delete chain
- 🆕 Map chain key range / velocity range (zones)
- 🆕 Set chain devices
- 🆕 Drum rack: get/set pads (note 36-99), pad chains, pad device
- 🆕 Drum rack: load sample to pad (path)
- 🆕 Drum rack: choke groups
- 🆕 Macros (1-16 in Live 12): name, value, get/set, randomize
- 🆕 Macro variations (Live 12): list, snap, recall
- 🆕 parameter → macro mapping (with curve, min/max range, invert)
- 🆕 Listen: chain solo/mute, macro value

### 4.9 Automation (Arrangement & Session)
- 🆕 List automation lanes on a track
- 🆕 Get envelope for `(track, device, parameter)` in arrangement
- 🆕 Add/remove/edit envelope points (time, value, curve)
- 🆕 Clear automation
- 🆕 Re-enable automation
- 🆕 Clip envelopes (session): same, but in the clip
- 🆕 Automation modes (Latch/Touch/Read/Write)
- 🆕 Bulk: "create a filter cutoff fade-in from 0 to 1 over 8 bars"
- 🆕 Listen: automation playback values

### 4.10 Modulation (Live 12 M4L Modulators)
- 🆕 List modulation sources (LFO, Envelope Follower, Shaper, Random)
- 🆕 Map source → target parameter
- 🆕 Set modulation depth, polarity, rate
- 🆕 List active modulations

### 4.11 Browser & Library
- ✅🟡 Get browser tree (category: instruments, drums, audio_effects, etc.)
- ✅🟡 Get items at path
- 🆕 Search by name (fuzzy)
- 🆕 Filter by tag (Sounds/Drums/Bass, etc.)
- 🆕 Filter by pack
- 🆕 Identify installed packs + version
- 🆕 Knowledge base of official packs (Beat Tools, Skitter & Step, Drive & Glow, etc.) and their contents
- 🆕 Resolve ambiguous URI ("808 kick" → top match with score)
- 🆕 User Library navigation
- 🆕 Recently used devices/samples

### 4.12 Arrangement View
- 🟡 Get arrangement clips (track) — names, lengths, start_times
- ✅🟡 Duplicate session clip → arrangement (track, slot, destination)
- 🆕 Place clip in arrangement (any track + position)
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
- 🟡 Volume, pan, sends, solo, mute, arm (already on Track)
- 🆕 Send count + creating a new return
- 🆕 Master volume, master pan
- 🆕 Crossfader value + curve
- 🆕 Cue volume / Cue out routing (DJ booth)
- 🆕 Quick Channel EQ (high/mid/low) without loading EQ Three
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
- 🟡 Show message in statusbar
- ✅🟡 Switch session/arrangement view
- 🆕 Show detail view (clip/device)
- 🆕 Highlight track/clip (select + scroll)
- 🆕 Close all device UIs
- 🆕 Toggle browser
- 🆕 Toggle Hot Swap

### 4.16 MIDI mapping / Remote control / Key map
- 🟡 Map CC → parameter (channel, cc, track_id, device_id, param_id)
- 🆕 Unmap CC
- 🆕 Map Note → parameter
- 🆕 Key mapping (computer keyboard → function)
- 🆕 List all MIDI mappings
- 🆕 Map relative / absolute / takeover mode
- 🆕 MIDI sync (in/out, send clock, song position)

### 4.17 Grooves
- 🆕 Groove pool: list loaded grooves
- 🆕 Load groove (.agr) from library
- 🆕 Apply groove to clip
- 🆕 Set groove amount on clip + global

### 4.18 Push & Move
- 🆕 Push 1/2/3: pads, encoders, LEDs, modes
- 🆕 Push 3 Standalone: send set, sync via Move
- 🆕 Move: list sets, transfer set, remote transport control

### 4.19 Max for Live (M4L)
- 🆕 Detect M4L devices on any track
- 🆕 Get exposed parameters (live.numbox, live.dial)
- 🆕 Get device patcher metadata (internal devices for introspection)
- 🆕 Load M4L device from path
- 🆕 Trigger functions exposed via M4L API (hello-message)

### 4.20 Session-level introspection (MCP resources)
- 🆕 `live://session/state` — full snapshot (all tracks, devices, params, clips, scenes)
- 🆕 `live://session/timeline` — arrangement as JSON
- 🆕 `live://session/mixer` — mixer state
- 🆕 `live://browser/tree` — browser tree
- 🆕 `live://devices/catalog` — knowledge base of native devices
- 🆕 `live://recipes/index` — list of available recipes

### 4.21 Reactivity (listeners → MCP notifications)
- 🆕 Subscribe to property changes (tempo, is_playing, selected_clip, etc.)
- 🆕 Subscribe to beat tick (every beat)
- 🆕 Subscribe to meter level (VU)
- 🆕 Subscribe to parameter changes (automation playback)
- 🆕 Server emits as MCP `notification/progress` or via Server-Sent resource updates

---

## 5. Embedded knowledge base

So the LLM **stops guessing parameters**. Inspired by what tdmcp does with the 629 TouchDesigner operators.

### 5.1 Native devices (`src/knowledge/devices/`)

One JSON per device, with the full parameter schema. Example:

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
    // ... ~150 parameters
  ],
  "presets": ["Bass Wobble", "Lead Square", "Pad Ethereal", ...],
  "macro_targets": ["Filter Cutoff", "Osc 1 Position", "Sub Volume"]
}
```

**Devices covered** (Live 12 native):

- **Instruments**: Wavetable, Operator, Drift, Meld, Bass, Sampler, Simpler, Drum Sampler, Drum Rack, Instrument Rack, Impulse, Tension, Collision, Electric, Analog, External Instrument
- **MIDI Effects**: Arpeggiator, Chord, Note Length, Pitch, Random, Scale, Velocity, MPE Control, MIDI Monitor
- **Audio Effects**: EQ Eight, EQ Three, Glue Compressor, Compressor, Multiband Dynamics, Limiter, Gate, Drum Buss, Saturator, Roar, Pedal, Amp, Cabinet, Reverb, Hybrid Reverb, Echo, Delay, Filter Delay, Grain Delay, Auto Filter, Auto Pan, Frequency Shifter, Phaser-Flanger, Chorus-Ensemble, Vinyl Distortion, Erosion, Redux, Beat Repeat, Looper, Tuner, Spectrum, Spectral Resonator, Spectral Time, Channel EQ, Utility, Gated Delay, Shifter, Vocoder, Corpus
- **Native Max for Live**: LFO, Envelope Follower, Shaper, Expression Control, etc.

### 5.2 Official packs (`src/knowledge/packs/`)

Index of Ableton + Cycling '74 packs. For each pack: name, category, main devices/samples, URIs. Enables "load a techno kick from pack X".

### 5.3 Music theory (`src/knowledge/`)

- `scales.json` — 38 scales (Major, Natural/Harmonic/Melodic Minor, Dorian, Phrygian, Lydian, Mixolydian, Locrian, Major/Minor Pentatonic, Blues, Hirajoshi, Ryukyu, Whole tone, Chromatic, etc.) with degrees and tensions.
- `chords.json` — common voicings by genre (jazz, pop, neo-soul).
- `grooves.json` — native Live grooves indexed.
- `midi.json` — General MIDI map, CC standards (modulation, expression, sustain), velocity curves.

### 5.4 BPM/genre/key reference

Usual BPM and key ranges per genre — house 120-128, techno 125-135, D&B 170-180, trap 130-150, etc.

---

## 6. Recipes (`recipes/`)

Declarative JSON the server expands into tool sequences. Inspired by `tdmcp/recipes/feedback_network_basic.json`.

Example:

```jsonc
// recipes/drums/tech-house-kit.json
{
  "name": "Tech House Drum Kit",
  "description": "Pre-configured drum rack: punchy kick, analog clap, 909 hat, open ride, shaker perc, sub kick.",
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
    // ... more pads
    { "tool": "load_device", "params": { "uri": "Live:AudioEffects:DrumBuss" } },
    { "tool": "device_set_param", "params": { 
        "device": "$last", "name": "Drive", "value": 0.3 } },
    { "tool": "create_midi_clip", "params": { "slot": 0, "length": 4 } },
    { "tool": "apply_recipe", "params": { "name": "drums/tech-house-pattern" } }
  ]
}
```

**Initial recipe categories**:

- `drums/` — house, techno, tech-house, D&B (amen, halftime), trap, dembow, hip-hop boom-bap, garage, breaks
- `bass/` — sub 808, reese, acid, rolling tech-house bass, jazz upright, slap bass
- `chords/` — pop pads, jazz extended, neo-soul Rhodes, lo-fi chops, ambient pad layers
- `racks/` — sidechain rack (kick→bus), parallel comp, vocal chain (de-ess + comp + EQ + reverb), light mastering chain, lo-fi tape
- `arrangements/` — 4/6/8-minute skeletons per genre (intro/build/drop/breakdown/outro with locators)
- `mixing/` — gain staging starter, master bus, drum bus, vocal bus
- `live_performance/` — Push 3 standalone template, looper setup, DJ deck simulator

---

## 7. create → verify → preview loop

The central mechanism that sets ableton-mind apart from dumb OSC wrappers.

```
                ┌────────────┐
                │  LLM gens  │
                └─────┬──────┘
                      │ calls tool (create track, load device…)
                      ▼
              ┌──────────────────┐
              │ ableton-mind     │ executes via bridge
              └─────┬────────────┘
                    │
                    ▼
              ┌──────────────────┐
              │ verify           │ re-reads state (lists tracks, devices, clips)
              └─────┬────────────┘
                    │  diff vs intent
                    ▼
                ┌──────────┐  ok? ─► proceed
                │ Verdict  │  
                └────┬─────┘  divergence? ─► retry with correction
                     │ (max N attempts)
                     ▼
              ┌──────────────────┐
              │ preview          │ (optional, on-demand)
              └─────┬────────────┘
                    │
       ┌────────────┼────────────┐
       ▼            ▼            ▼
  Session JSON  Render audio  Screenshot UI
   (snapshot)    8 bars WAV   via macOS
```

**Verify** (always):
- After each batch, reads the relevant state and compares against the expected schema.
- Detects: device in the wrong slot, parameter out of range, empty clip when it should have notes.
- Tools return `{ ok, verified, diff }` instead of just `ok`.

**Preview** (optional, on demand):
- `preview_session_state` — lean session JSON for the LLM to "see".
- `preview_render` — requests a temporary `Song.create_audio_track` + N-bar bounce via `Song.export_audio` (Live 12.1+) or uses freeze.
- `preview_screenshot` — captures the Live window via macOS `screencapture -l <window-id>` (the bridge needs to identify the pid).
- Returns as an MCP resource (image or audio) for the LLM to consume.

---

## 8. MCP surface — tools, resources, prompts

### 8.1 Tools (~150)

Sketch by domain (final names TBD; convention `snake_case`):

| Domain | Examples | Estimated count |
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

### 8.2 MCP Resources

- `live://session/state` (live snapshot, refreshes every N seconds)
- `live://session/timeline` (arrangement clips as JSON)
- `live://browser/tree` (cached, invalidated on event)
- `live://devices/catalog` (knowledge base)
- `live://recipes/index`
- `live://transport/now` (push of tempo, beat, is_playing — server-side updates)

### 8.3 MCP Prompts (templates)

- `compose_track` — "compose a track in style X with Y bars"
- `mix_balance` — "balance the levels of the tracks"
- `arrange_session` — "extend this loop into a full arrangement"
- `sound_design` — "create a Wavetable patch in style X"
- `mastering_chain` — "set up a light mastering chain"

---

## 9. Transport / install / distribution

Same as tdmcp:

| Channel | Package | Audience |
|---|---|---|
| Claude Desktop | `.mcpb` (Claude Desktop Bundle, ex-`.dxt`) | Non-technical user, 1 click |
| Claude Code / Cursor / Codex | npm `@dpantani/ableton-mind` | Devs |
| Smithery | hosted | Multi-client cloud |
| Docker | container | CI / sandboxes |
| GitHub release | direct binary | Air-gapped |

**Remote Script** installs in:

- macOS: `~/Music/Ableton/User Library/Remote Scripts/AbletonMind/`
- Windows: `~/Documents/Ableton/User Library/Remote Scripts/AbletonMind/`

Setup script (`ableton-mind setup`) creates a symlink/copy + opens Live to activate it under Preferences → Link/Tempo/MIDI → Control Surface.

---

## 10. Complementary CLI (`ableton-mind-agent`, `ableton-mind doctor`)

Mirroring `tdmcp-agent`:

- `ableton-mind doctor` — checks: Live running? Remote Script enabled? Port free? Live version ≥ 11? Python inside Live OK?
- `ableton-mind agent` — local REPL that uses the knowledge base + recipes without requiring Claude (optional OpenAI/Anthropic key support).
- `ableton-mind probe` — discovers a running Live and dumps a snapshot.

---

## 11. Known risks & limitations

| Risk | Mitigation |
|---|---|
| Remote Scripts run single-threaded on the audio thread. Long operations (loading a 5GB pack) block. | The bridge does everything via `Live.Application.get_application().get_document().schedule(...)` when possible; long tools marked as `async` in MCP with progress. |
| Live 12 moved Python to 3.11 — Live 10/11 uses 3.7. | The bridge keeps 3.7+ compatibility or a "live12-only" flag. Recommend Live 11+. |
| VST/AU plugins only expose automatable params (up to 128 in VST2). | Limit documented, fallback: uses preset.fxp/.aupreset. |
| Audio render via `Song.export_audio` is Live 12.1+ only. | For previous versions, uses freeze track + read frozen file. |
| Push 3 standalone over WiFi has latency. | Move sync recommended for transfers. |
| Loading a device by URI changes between versions/packs. | The knowledge base has versioned URIs; `resolve_uri` does fuzzy matching. |
| AbletonOSC and ableton-mind fighting over the same port. | Detected at startup, migration offered. |
| MCP protocol payload limits — a session with 200 tracks produces a huge resource. | Paginated resource: `live://session/state?tracks=10-20`. |

---

## 12. Phased roadmap

### Phase 0 — Spike (1-2 weeks)
- Repo scaffold copying `tdmcp` (TS+Node, tsup, biome, vitest, MCP SDK).
- Minimal Python bridge: TCP server, JSON-RPC dispatch, 5 handlers (play, stop, tempo, list tracks, create midi clip).
- TS client in the MCP server.
- 1 MCP tool: `play` end-to-end.
- Doc `docs/architecture.md`.

### Phase 1 — Parity with ahujasid (2-3 weeks)
- ahujasid's 22 tools working + verify loop.
- Transactions with unitary undo.
- Browser tree.
- Smoke tests running against real Live in CI (macOS runner).

### Phase 2 — Parity with AbletonOSC (3-4 weeks)
- All LOM getters/setters/methods (Song, Track, Clip Slot, Clip, Scene, Device, View).
- Listeners → MCP notifications.
- `live://session/state` resource.

### Phase 3 — Knowledge & Recipes (3-4 weeks)
- Schemas for the 50+ native devices.
- 30 recipes (drums, bass, chords, racks, mixing).
- `set_device_param_by_name` tool resolving via knowledge.
- `apply_recipe` tool.

### Phase 4 — Advanced coverage (4-6 weeks)
- Full automation (arrangement + clip envelopes).
- Modulation (Live 12).
- Deep racks (drum, instrument, audio, MIDI).
- Per-note MPE, probability.
- Granular warp markers.
- Take lanes.

### Phase 5 — Preview & Feedback (2-3 weeks)
- `render_preview` (8-bar bounce).
- `screenshot_live` (macOS + Windows).
- Session diff (previous snapshot vs current).

### Phase 6 — Push & Move (3-4 weeks)
- Push 1/2/3 LEDs/pads/modes.
- Move sync.

### Phase 7 — Distribution & Docs (2-3 weeks)
- `.mcpb` (Claude Desktop).
- Smithery listing.
- Docker.
- VitePress docs with English root and `docs/pt` localization.
- Prompt cookbook.
- Recipe gallery with rendered audio.

### Phase 8 — Long tail
- Max for Live patcher introspection.
- VST3 sidecar (expanded params).
- Integration with remote DAW (Live Link).
- Mobile Push companion.

**Total estimate**: ~6 months of one person full-time to reach a solid v1.0 (Phases 0-5). Phases 6-8 are post-1.0 roadmap.

---

## 13. Open decisions (need input before starting)

| Question | Options | Initial recommendation |
|---|---|---|
| MCP server language | TypeScript (= tdmcp), Python (= ahujasid) | **TypeScript** — coherence with tdmcp, better MCP ecosystem in TS, better Zod tooling. |
| bridge↔server transport | TCP socket JSON-RPC, WebSocket, OSC | **TCP JSON-RPC** as primary + optional OSC. |
| Minimum Live version | 10, 11, 12 | **Live 11** — drops few users, gains take lanes / MPE / probability. |
| AbletonOSC support | Drop-in replacement or coexist? | **Coexist** — flag to use OSC as transport. |
| Final name | `ableton-mind`, `abletonmcp`, `livemcp`, other | **ableton-mind** is already the directory. Good name (mirrors tdmcp as "mind designer"). |
| License | MIT (= tdmcp), AGPL, Apache 2.0 | **MIT** — aligned with tdmcp. |
| Windows support | day 1 or Mac first | **Mac first** (Live is more used on Mac, faster dev), Windows in Phase 1. |
| Device knowledge: scrape or manual | Live has `Default.adv` in XML, extractable; or manual with Ableton docs | **Hybrid** — `scripts/extract-device-schemas.mjs` gets the base, manual completes. |
| Preview rendering | Real bounce (slow) or MIDI/audio simulation (fast, imperfect) | **Real bounce** opt-in, default = JSON snapshot. |

---

## 14. Final comparison

| Capability | ahujasid/ableton-mcp | AbletonOSC + MCP wrapper | **ableton-mind** |
|---|---|---|---|
| MCP tools | 22 | ~30 (shallow wrapper) | **~180** |
| LOM coverage | ~10% | ~95% | **~100%** |
| Knowledge base | none | none | **50+ devices, scales, packs, grooves** |
| Recipes | none | none | **30+ in v1, extensible** |
| Verify loop | no | no | **yes, integrated** |
| Preview (render/screenshot) | no | no | **yes** |
| Reactive listeners | no | yes (OSC) | **yes (MCP notifications)** |
| Transactions (unitary undo) | no | no | **yes** |
| Automation envelopes | no | partial | **complete** |
| Deep racks | drum only (load) | basic read | **full CRUD** |
| Modulation (Live 12) | no | partial | **complete** |
| Push / Move | no | no | **yes** |
| `docs/pt` localization | no | no | **yes** |
| DXT/MCPB 1-click | no | no | **yes** |
| CLI + doctor | no | no | **yes** |

---

## 15. Suggested next steps

1. **Validate this plan** — you review, adjust scope (drop Push/Move? drop preview? include Live 10?).
2. **Decide the open questions** from section 13 (mainly: TS confirmed? Live 11+ confirmed?).
3. **Phase 0 spike** — I can already start scaffolding the repo by copying the tdmcp structure adapted to Ableton, with 1 tool working end-to-end (`play` / `stop` / `set_tempo`).
4. **Pack inventory** — you list which Ableton packs you have installed so I can prioritize URIs in the knowledge base.
5. **Seed recipes** — you list the 5-10 genres/patterns that interest you most (techno? D&B? lo-fi? jazz?) so I can start with the recipes you will actually use.

---

*Planning document — ableton-mind v0.0.1-plan.*
