# Phase 0 — Métodos do Spike

**Escopo:** 5 handlers + handshake. O suficiente para 1 tool MCP `play` ponta a ponta.

## 1. `system.hello`

Handshake obrigatório. Bridge não responde nenhum outro método antes.

**Request params:**
```ts
{ client: string; version: string }
```

**Response result:**
```ts
{
  bridge: string;            // "ableton-mind/python"
  version: string;           // "0.0.1"
  live_version: string;      // "12.0.10"
  python_version: string;    // "3.11.6"
  protocol_version: string;  // "0.1"
}
```

## 2. `system.ping`

Health check. Server deve responder rápido (<10ms).

**Request params:** `{}`
**Response result:** `{ pong: true, ts: number /* unix epoch ms */ }`

## 3. `transport.play`

Inicia playback. Idempotente: se já tocando, retorna `changed: false`.

**Request params:**
```ts
{ from_beginning?: boolean }   // default false → continue
```

**Response result:**
```ts
{
  changed: boolean;
  is_playing: boolean;       // sempre true após op
  current_song_time: number; // em beats
}
```

**Erros:**
- `-32000` Live not running

## 4. `transport.stop`

Para playback. Idempotente.

**Request params:** `{}`
**Response result:**
```ts
{
  changed: boolean;
  is_playing: false;
  current_song_time: number;
}
```

## 5. `transport.set_tempo`

Muda tempo global. Idempotente.

**Request params:**
```ts
{ bpm: number }   // 20.0–999.0 (faixa Live)
```

**Response result:**
```ts
{
  changed: boolean;
  before: number;   // bpm anterior
  after: number;    // bpm atual (= bpm se applied)
}
```

**Erros:**
- `-32004` Out of range. `error.data = { min: 20, max: 999, got: <input> }`

## 6. `track.list`

> **ATUALIZADO em Cycle 2 por [ADR-0002](../decisions/0002-track-list-shape.md)** —
> shape antigo (`tracks` único com indexes negativos) substituído por coleções
> separadas. O bloco abaixo já é a versão atual.

Lista tracks separando regular, return e master. Read-only.

**Request params:**
```ts
{ include_master?: boolean; include_returns?: boolean }   // ambos default true
```

**Response result:**
```ts
{
  tracks: Array<{
    index: number;       // posição em song.tracks (0..N-1)
    name: string;
    color_index: number;
    is_midi: boolean;
    is_audio: boolean;
    is_grouped: boolean;
    is_foldable: boolean;
    mute: boolean;
    solo: boolean;
    arm: boolean;
  }>;
  return_tracks: Array<{
    index: number;       // posição em song.return_tracks (0..M-1)
    name: string;
    color_index: number;
    mute: boolean;
    solo: boolean;
  }>;
  master_track: {
    name: string;
    color_index: number;
  } | null;              // null em testes; em runtime real sempre presente
  total: number;          // tracks + return_tracks + (master ? 1 : 0)
}
```

## 7. `clip.create_midi`

Cria MIDI clip vazio num slot. Transacional (begin/end_undo_step).

**Request params:**
```ts
{
  track_index: number;     // index de track MIDI
  clip_slot_index: number; // index do slot
  length_beats: number;    // ex 4.0 = 1 bar a 4/4
  name?: string;
}
```

**Response result:**
```ts
{
  changed: boolean;
  clip: {
    track_index: number;
    clip_slot_index: number;
    name: string;
    length_beats: number;
  };
}
```

**Erros:**
- `-32002` Track não existe. `data = { num_tracks: N }`
- `-32003` Track não é MIDI. `data = { expected: "midi", actual: "audio" }`
- `-32005` Slot já ocupado. `data = { existing_clip_name: "..." }`

## 8. (opcional) `event.beat` — notification

Bridge MAY push beat events. Phase 0 NÃO obriga. Se implementar:

```ts
{
  beat: number;        // beat number absoluto
  bar: number;         // bar number
  song_time: number;   // beats from start
}
```

## 9. `track.create` (adicionado em Cycle 2 — primeira tool além de Phase 0 strict)

Cria audio ou MIDI track. Não idempotente: chamadas repetidas criam várias tracks.

**Request params:**
```ts
{
  type: "midi" | "audio";
  index?: number;     // posição em song.tracks após criação; omitido = append no fim
  name?: string;      // se omitido, Live usa nome default ("X MIDI N" / "X Audio N")
}
```

**Response result:**
```ts
{
  changed: true;
  track: {
    index: number;
    name: string;
    is_midi: boolean;
    is_audio: boolean;
  };
}
```

**Erros:**
- `-32002` `type` desconhecido. `data = { expected: ["midi","audio"], got: <input> }`
- `-32004` `index` fora de `[0, num_tracks]`. `data = { min, max, got }`

Transacional: envolve em `undo_step("track.create", song)`.

## 10. `track.upsert` (Cycle 3) — idempotente por nome

Cria track só se nenhuma com `name=X` existir. Idempotente.

**Request:** `{ name: string; type: "midi" | "audio"; index?: number }`
**Response:**
```ts
{
  changed: boolean;
  track: { index: number; name: string; is_midi: boolean; is_audio: boolean };
}
```
**Erros:** `-32002` se `name` vazio ou `type` inválido; `-32004` se `index > num_tracks`.

## 11. `track.set_name` (Cycle 3)

Renomeia track regular. Idempotente.

**Request:** `{ index: number; name: string }`
**Response:** `{ changed: boolean; before: string; after: string }`
**Erros:** `-32002` se `index` fora.

## 12. `track.set_volume` (Cycle 3) — ADR-0004

Volume normalized 0..1. Idempotente em 1e-4.

**Request:** `{ index: number; volume: number /* 0..1 */ }`
**Response:**
```ts
{
  changed: boolean;
  before: number;     // 0..1
  after: number;
  before_db: number;  // aprox piecewise tabela ADR-0004
  after_db: number;
}
```
**Erros:** `-32002` track não existe; `-32004` volume fora.

## 13. `clip.add_notes` (Cycle 3) — ADR-0003

Adiciona notas MIDI a clip existente. NÃO idempotente (acumula).

**Request:**
```ts
{
  track_index: number;
  clip_slot_index: number;
  notes: Array<{
    pitch: number;        // 0..127
    start: number;        // beats
    duration: number;     // beats, > 0
    velocity?: number;    // 0..127, default 100
    mute?: boolean;       // default false
  }>;
}
```
**Response:**
```ts
{ changed: true; added: number; track_index: number; clip_slot_index: number }
```
**Erros:** `-32002` slot vazio; `-32003` clip não é MIDI; `-32602` notes mal-formadas; `-32004` valor fora de range em nota individual (com `index` da nota culpada em `error.data.index`).

## 14. `clip.fire` / `clip.stop` (Cycle 3)

Dispara / para um clip. Idempotente.

**Request:** `{ track_index: number; clip_slot_index: number }`
**Response:**
```ts
{ changed: boolean; is_playing: boolean; track_index: number; clip_slot_index: number }
```

## 15. `clip.set_name` (Cycle 3)

Renomeia clip. Idempotente.

**Request:** `{ track_index: number; clip_slot_index: number; name: string }`
**Response:** `{ changed: boolean; before: string; after: string }`

## 16. `session.get_info` (Cycle 3)

Snapshot top-level read-only.

**Request:** `{}`
**Response:**
```ts
{
  name: string;
  num_tracks: number;
  num_return_tracks: number;
  has_master: boolean;
  tempo: number;
  time_signature: { numerator: number; denominator: number };
  is_playing: boolean;
  song_time: number;
  song_length: number;
  root_note: number;       // 0..11
  scale_name: string;
}
```

## 17. `browser.get_categories` (Cycle 3)

Lista categorias raiz do Live Browser.

**Request:** `{}`
**Response:**
```ts
{
  categories: Array<{ key: string; name: string; is_folder: boolean; is_loadable: boolean }>;
  available: boolean;
  reason?: string;   // presente quando available=false (ex: headless)
}
```

## 18. `track.get_info` (Cycle 4)

Read-only, detalhado por track regular.

**Request:** `{ index: number }`
**Response:**
```ts
{
  index: number;
  name: string;
  color_index: number;
  is_midi: boolean;
  is_audio: boolean;
  mute: boolean;
  solo: boolean;
  arm: boolean;
  volume: number;          // 0..1
  volume_db: number;
  panning: number;         // -1..1
  num_sends: number;
  num_clip_slots: number;
  num_clips: number;       // slots com has_clip
  num_devices: number;
}
```

## 19. `scene.fire` (Cycle 4)

Dispara uma cena por index.

**Request:** `{ index: number }`
**Response:** `{ changed: true; index: number; name: string }`
**Erros:** `-32002` se `index` fora; `-32000` se Live não disponível.

## 20. `clip.set_loop` (Cycle 4)

Configura loop do clip. Idempotente em 1e-4.

**Request:**
```ts
{
  track_index: number;
  clip_slot_index: number;
  loop_start?: number;
  loop_end?: number;
  looping?: boolean;
}
```
**Response:**
```ts
{
  changed: boolean;
  before: { loop_start: number; loop_end: number; looping: boolean };
  after: { loop_start: number; loop_end: number; looping: boolean };
}
```

## 21. `browser.load_item` (Cycle 5)

Carrega um BrowserItem na track selecionada/armada. LiveAPI: `application.browser.load_item(item)` (Live escolhe a track destino sozinho).

**Request:**
```ts
{ path: string[] }   // ex: ["instruments", "Wavetable", "Pads", "Air Pad"]
```

**Response:**
```ts
{ loaded: true; name: string; path: string[] }
```

**Erros:**
- `-32000` browser unavailable (headless).
- `-32602` path vazio.
- `-32002` root category não existe (`error.data.valid` lista válidos) OU item não achado em algum nível (`error.data.path`, `missing_at`, `missing`, `available`).
- `-32005` item é folder, não loadável (`error.data.is_folder=true`).
- `-32001` load_item raised exception no Live (`error.data.reason`).

## 22. `device.get_parameters` (Cycle 5)

Read-only. Lista os parameters de UM device em `(track_index, device_index)`.

**Request:**
```ts
{ track_index: number; device_index: number }
```

**Response:**
```ts
{
  device_name: string;
  class_name: string;
  parameters: Array<{
    index: number;
    name: string;
    value: number;
    min: number;
    max: number;
    is_quantized: boolean;
    value_items: string[];     // valores discretos (enum) quando is_quantized
    automation_state: number;  // 0=none, 1=arrangement, 2=session
  }>;
  total: number;
}
```

**Erros:** `-32002` track ou device fora.

> Lado TS: tool `device_get_parameters` enriquece o response com `knowledge` (`{unit, description, automatable, modulatable}`) quando o device é encontrado na knowledge base + adiciona `knowledge_matched: boolean`.

## 23. `device.set_parameter` (Cycle 5)

Set por **index** (resolução name→index é responsabilidade do lado TS, que faz 1 round-trip de `device.get_parameters`). Idempotente em 1e-4 (ou igualdade exata para `is_quantized`).

**Request:**
```ts
{ track_index: number; device_index: number; parameter_index: number; value: number }
```

**Response:**
```ts
{
  changed: boolean;
  name: string;
  before: number;
  after: number;
}
```

**Erros:**
- `-32002` track/device/parameter fora.
- `-32004` value fora de `[min, max]`. `data = { min, max, got, param_name }`.

Transacional: envolve em `undo_step("device.set_parameter", song)`.

## 24. Notifications (`event.*`) — Phase 2 (ADR-0005)

Bridge envia notifications JSON-RPC 2.0 **sem `id`** para todos os clientes conectados via `BridgeServer.broadcast(method, params)`. Naming: `event.<domain>_<property>_changed`.

Shape padrão:
```ts
{
  jsonrpc: "2.0",
  method: "event.<name>",
  params: {
    value: T;          // estado atual
    previous?: T;      // valor anterior quando rastreado
    ts: number;        // unix epoch ms (server wall clock)
    track_index?: number;
    clip_slot_index?: number;
    return_track_index?: number;
  }
}
```

### Eventos ativos em Cycle 5/6

| Method | `params` extras | Trigger |
|---|---|---|
| `event.transport_tempo_changed` | `{ value: number; previous: number; ts: number }` | `Song.add_tempo_listener` |
| `event.transport_is_playing_changed` | `{ value: boolean; previous: boolean; ts: number }` | `Song.add_is_playing_listener` |

Phase 2 segue expandindo com listeners de track (`name`, `mute`, `solo`, `volume`) e clip (`name`, `is_playing`, `loop`).

Lado TS: `attachNotificationForwarder` no server bootstrap repassa apenas methods `event.*` para `McpServer.server.notification(...)`. Notifications fora do prefixo são logadas e descartadas.

## 25. `clip.envelope_set_points` (Cycle 7 — Phase 4, ADR-0006)

Substitui TODOS os pontos de um clip automation envelope. Transacional. Idempotente em sentido fraco (mesma lista produz mesmo resultado).

**Request:**
```ts
{
  track_index: number;
  clip_slot_index: number;
  parameter_locator: {
    kind: "mixer_volume" | "mixer_panning" | "mixer_send" | "device_param";
    send_index?: number;
    device_index?: number;
    parameter_index?: number;
  };
  points: Array<{ time: number; value: number; curve_type?: "linear" | "ramp" | "hold" }>;
}
```

**Response:**
```ts
{
  changed: true;
  replaced: true;
  points: number;        // quantidade inserida
  track_index: number;
  clip_slot_index: number;
}
```

**Erros:**
- `-32002` slot vazio ou clip não existe.
- `-32602` `points` inválido (cada point precisa `time` e `value`).
- `-32008` `parameter_locator` inválido (kind desconhecido, send_index/device_index fora).
- `-32602` clip sem `create_automation_envelope` (Live antigo).

## 26. `arrangement.add_automation_point` (Cycle 7 — Phase 4)

Adiciona UM ponto a um automation envelope no arrangement view. NÃO idempotente.

**Request:**
```ts
{
  track_index: number;
  parameter_locator: { kind, ... };       // mesmo shape de §25
  time: number;                            // beats desde t=0 da song
  value: number;
  curve_type?: "linear" | "ramp" | "hold"; // default "linear"
}
```

**Response:**
```ts
{ added: true; track_index: number; time: number; value: number; curve_type: string }
```

**Erros:**
- `-32002` track fora.
- `-32008` locator inválido.
- `-32602` track sem `create_or_get_automation_envelope` (Live antigo).

## 27. `session.snapshot` (Cycle 9, Phase 5)

Deep read-only snapshot. Request `{ include_clips?, include_devices? }` defaults true. Response inclui tempo, transport, signature, tracks com clips/devices metadata.

## 28. `session.diff` (Cycle 9, Phase 5)

Recursive diff entre snapshot anterior e atual. Ignora `ts`. Response: `{ from_ts, to_ts, changes: Array<{path,before,after,kind}>, count }`.

## 29. `render.preview` (Cycle 9, Phase 5)

Modo `"snapshot"` retorna deep state. Modo `"bounce"` Cycle 11+.

## 30. Recipes (Cycle 9, Trilha C, ADR-0007)

`list_recipes { category? }` e `apply_recipe { recipe_id, overrides? }`. Implementados puro TS sobre `recipes/*.json` embarcadas. Não fala com bridge para listing; `apply_recipe` chama bridge via runner.

## 31. `push.set_pad_color` / `push.set_button_led` (Cycle 10, Phase 6, ADR-0008)

Sysex MIDI para Push 2/3 LEDs.
- pad: 0..63 (8x8 grid). color: 0..127.
- button: enum (`Play`, `Record`, `Stop`, `Tap Tempo`, `Metronome`, `Mute`, `Solo`, etc). mode: `"solid"` | `"blink"` | `"pulse"`.

`-32000` quando Push não detectado (`detected: false`).

## Resumo (após Cycle 10)

30 métodos JSON-RPC request/response no bridge (28 expostos + 2 system) + 7 notifications `event.*` (track/clip listeners).

Server MCP TS expõe **30 tools**:

| Categoria | Tools MCP |
|---|---|
| transport | play, stop, set_tempo |
| track | track_list, track_get_info, track_create, track_upsert, track_set_name, track_set_volume |
| clip | create_midi_clip, clip_add_notes, clip_fire, clip_stop, clip_set_name, clip_set_loop, clip_set_envelope |
| scene | scene_fire |
| session | session_get_info |
| browser | browser_get_categories, browser_load_item |
| device | device_get_parameters, device_set_parameter |
| arrangement (Phase 4) | arrangement_add_automation_point |
| preview (Phase 5) | session_snapshot, session_diff, render_preview |
| recipes (Trilha C) | list_recipes, apply_recipe |
| push (Phase 6) | push_set_pad_color, push_set_button_led |
| arrangement | arrangement_add_automation_point |
