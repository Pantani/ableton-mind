# Phase 0 — Spike Methods

**Scope:** 5 handlers + handshake. Enough for 1 end-to-end MCP `play` tool.

## 1. `system.hello`

Mandatory handshake. The bridge does not respond to any other method before.

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

Health check. The server must respond quickly (<10ms).

**Request params:** `{}`
**Response result:** `{ pong: true, ts: number /* unix epoch ms */ }`

## 3. `transport.play`

Starts playback. Idempotent: if already playing, returns `changed: false`.

**Request params:**
```ts
{ from_beginning?: boolean }   // default false → continue
```

**Response result:**
```ts
{
  changed: boolean;
  is_playing: boolean;       // always true after op
  current_song_time: number; // in beats
}
```

**Errors:**
- `-32000` Live not running

## 4. `transport.stop`

Stops playback. Idempotent.

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

Changes global tempo. Idempotent.

**Request params:**
```ts
{ bpm: number }   // 20.0–999.0 (Live range)
```

**Response result:**
```ts
{
  changed: boolean;
  before: number;   // previous bpm
  after: number;    // current bpm (= bpm if applied)
}
```

**Errors:**
- `-32004` Out of range. `error.data = { min: 20, max: 999, got: <input> }`

## 6. `track.list`

> **UPDATED in Cycle 2 by [ADR-0002](../decisions/0002-track-list-shape.md)** —
> old shape (single `tracks` with negative indexes) replaced by separate
> collections. The block below is already the current version.

Lists tracks separating regular, return and master. Read-only.

**Request params:**
```ts
{ include_master?: boolean; include_returns?: boolean }   // both default true
```

**Response result:**
```ts
{
  tracks: Array<{
    index: number;       // position in song.tracks (0..N-1)
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
    index: number;       // position in song.return_tracks (0..M-1)
    name: string;
    color_index: number;
    mute: boolean;
    solo: boolean;
  }>;
  master_track: {
    name: string;
    color_index: number;
  } | null;              // null in tests; always present in real runtime
  total: number;          // tracks + return_tracks + (master ? 1 : 0)
}
```

## 7. `clip.create_midi`

Creates an empty MIDI clip in a slot. Transactional (begin/end_undo_step).

**Request params:**
```ts
{
  track_index: number;     // MIDI track index
  clip_slot_index: number; // slot index
  length_beats: number;    // e.g. 4.0 = 1 bar at 4/4
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

**Errors:**
- `-32002` Track does not exist. `data = { num_tracks: N }`
- `-32003` Track is not MIDI. `data = { expected: "midi", actual: "audio" }`
- `-32005` Slot already occupied. `data = { existing_clip_name: "..." }`

## 8. (optional) `event.beat` — notification

The bridge MAY push beat events. Phase 0 does NOT require it. If implemented:

```ts
{
  beat: number;        // absolute beat number
  bar: number;         // bar number
  song_time: number;   // beats from start
}
```

## 9. `track.create` (added in Cycle 2 — first tool beyond strict Phase 0)

Creates an audio or MIDI track. Not idempotent: repeated calls create multiple tracks.

**Request params:**
```ts
{
  type: "midi" | "audio";
  index?: number;     // position in song.tracks after creation; omitted = append at end
  name?: string;      // if omitted, Live uses default name ("X MIDI N" / "X Audio N")
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

**Errors:**
- `-32002` unknown `type`. `data = { expected: ["midi","audio"], got: <input> }`
- `-32004` `index` outside `[0, num_tracks]`. `data = { min, max, got }`

Transactional: wraps in `undo_step("track.create", song)`.

## 10. `track.upsert` (Cycle 3) — idempotent by name

Creates a track only if none with `name=X` exists. Idempotent.

**Request:** `{ name: string; type: "midi" | "audio"; index?: number }`
**Response:**
```ts
{
  changed: boolean;
  track: { index: number; name: string; is_midi: boolean; is_audio: boolean };
}
```
**Errors:** `-32002` if `name` empty or `type` invalid; `-32004` if `index > num_tracks`.

## 11. `track.set_name` (Cycle 3)

Renames a regular track. Idempotent.

**Request:** `{ index: number; name: string }`
**Response:** `{ changed: boolean; before: string; after: string }`
**Errors:** `-32002` if `index` out of range.

## 12. `track.set_volume` (Cycle 3) — ADR-0004

Volume normalized 0..1. Idempotent at 1e-4.

**Request:** `{ index: number; volume: number /* 0..1 */ }`
**Response:**
```ts
{
  changed: boolean;
  before: number;     // 0..1
  after: number;
  before_db: number;  // approx piecewise table ADR-0004
  after_db: number;
}
```
**Errors:** `-32002` track does not exist; `-32004` volume out of range.

## 13. `clip.add_notes` (Cycle 3) — ADR-0003

Adds MIDI notes to an existing clip. NOT idempotent (accumulates).

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
**Errors:** `-32002` empty slot; `-32003` clip is not MIDI; `-32602` malformed notes; `-32004` value out of range in individual note (with the culprit note's `index` in `error.data.index`).

## 14. `clip.fire` / `clip.stop` (Cycle 3)

Triggers / stops a clip. Idempotent.

**Request:** `{ track_index: number; clip_slot_index: number }`
**Response:**
```ts
{ changed: boolean; is_playing: boolean; track_index: number; clip_slot_index: number }
```

## 15. `clip.set_name` (Cycle 3)

Renames a clip. Idempotent.

**Request:** `{ track_index: number; clip_slot_index: number; name: string }`
**Response:** `{ changed: boolean; before: string; after: string }`

## 16. `session.get_info` (Cycle 3)

Top-level read-only snapshot.

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

Lists the root categories of the Live Browser.

**Request:** `{}`
**Response:**
```ts
{
  categories: Array<{ key: string; name: string; is_folder: boolean; is_loadable: boolean }>;
  available: boolean;
  reason?: string;   // present when available=false (e.g. headless)
}
```

## 18. `track.get_info` (Cycle 4)

Read-only, detailed per regular track.

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
  num_clips: number;       // slots with has_clip
  num_devices: number;
}
```

## 19. `scene.fire` (Cycle 4)

Triggers a scene by index.

**Request:** `{ index: number }`
**Response:** `{ changed: true; index: number; name: string }`
**Errors:** `-32002` if `index` out of range; `-32000` if Live unavailable.

## 20. `clip.set_loop` (Cycle 4)

Configures clip loop. Idempotent at 1e-4.

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

Loads a BrowserItem on the selected/armed track. LiveAPI: `application.browser.load_item(item)` (Live chooses the destination track itself).

**Request:**
```ts
{ path: string[] }   // e.g.: ["instruments", "Wavetable", "Pads", "Air Pad"]
```

**Response:**
```ts
{ loaded: true; name: string; path: string[] }
```

**Errors:**
- `-32000` browser unavailable (headless).
- `-32602` empty path.
- `-32002` root category does not exist (`error.data.valid` lists valid ones) OR item not found at some level (`error.data.path`, `missing_at`, `missing`, `available`).
- `-32005` item is a folder, not loadable (`error.data.is_folder=true`).
- `-32001` load_item raised exception in Live (`error.data.reason`).

## 22. `device.get_parameters` (Cycle 5)

Read-only. Lists the parameters of ONE device at `(track_index, device_index)`.

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
    value_items: string[];     // discrete values (enum) when is_quantized
    automation_state: number;  // 0=none, 1=arrangement, 2=session
  }>;
  total: number;
}
```

**Errors:** `-32002` track or device out of range.

> TS side: the `device_get_parameters` tool enriches the response with `knowledge` (`{unit, description, automatable, modulatable}`) when the device is found in the knowledge base + adds `knowledge_matched: boolean`.

## 23. `device.set_parameter` (Cycle 5)

Set by **index** (name→index resolution is the TS side's responsibility, which does 1 round-trip of `device.get_parameters`). Idempotent at 1e-4 (or exact equality for `is_quantized`).

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

**Errors:**
- `-32002` track/device/parameter out of range.
- `-32004` value outside `[min, max]`. `data = { min, max, got, param_name }`.

Transactional: wraps in `undo_step("device.set_parameter", song)`.

## 24. Notifications (`event.*`) — Phase 2 (ADR-0005)

The bridge sends JSON-RPC 2.0 notifications **without `id`** to all connected clients via `BridgeServer.broadcast(method, params)`. Naming: `event.<domain>_<property>_changed`.

Standard shape:
```ts
{
  jsonrpc: "2.0",
  method: "event.<name>",
  params: {
    value: T;          // current state
    previous?: T;      // previous value when tracked
    ts: number;        // unix epoch ms (server wall clock)
    track_index?: number;
    clip_slot_index?: number;
    return_track_index?: number;
  }
}
```

### Events active in Cycle 5/6

| Method | extra `params` | Trigger |
|---|---|---|
| `event.transport_tempo_changed` | `{ value: number; previous: number; ts: number }` | `Song.add_tempo_listener` |
| `event.transport_is_playing_changed` | `{ value: boolean; previous: boolean; ts: number }` | `Song.add_is_playing_listener` |

Phase 2 continues expanding with track listeners (`name`, `mute`, `solo`, `volume`) and clip listeners (`name`, `is_playing`, `loop`).

TS side: `attachNotificationForwarder` in the server bootstrap forwards only `event.*` methods to `McpServer.server.notification(...)`. Notifications outside the prefix are logged and dropped.

## 25. `clip.envelope_set_points` (Cycle 7 — Phase 4, ADR-0006)

Replaces ALL points of a clip automation envelope. Transactional. Idempotent in a weak sense (same list produces the same result).

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
  points: number;        // amount inserted
  track_index: number;
  clip_slot_index: number;
}
```

**Errors:**
- `-32002` empty slot or clip does not exist.
- `-32602` invalid `points` (each point requires `time` and `value`).
- `-32008` invalid `parameter_locator` (unknown kind, send_index/device_index out of range).
- `-32602` clip without `create_automation_envelope` (old Live).

## 26. `arrangement.add_automation_point` (Cycle 7 — Phase 4)

Adds ONE point to an automation envelope in the arrangement view. NOT idempotent.

**Request:**
```ts
{
  track_index: number;
  parameter_locator: { kind, ... };       // same shape as §25
  time: number;                            // beats since t=0 of the song
  value: number;
  curve_type?: "linear" | "ramp" | "hold"; // default "linear"
}
```

**Response:**
```ts
{ added: true; track_index: number; time: number; value: number; curve_type: string }
```

**Errors:**
- `-32002` track out of range.
- `-32008` invalid locator.
- `-32602` track without `create_or_get_automation_envelope` (old Live).

## 27. `session.snapshot` (Cycle 9, Phase 5)

Deep read-only snapshot. Request `{ include_clips?, include_devices? }` defaults true. Response includes tempo, transport, signature, tracks with clips/devices metadata.

## 28. `session.diff` (Cycle 9, Phase 5)

Recursive diff between previous and current snapshot. Ignores `ts`. Response: `{ from_ts, to_ts, changes: Array<{path,before,after,kind}>, count }`.

## 29. `render.preview` (Cycle 9, Phase 5)

`"snapshot"` mode returns deep state. `"bounce"` mode Cycle 11+.

## 30. Recipes (Cycle 9, Track C, ADR-0007)

`list_recipes { category? }` and `apply_recipe { recipe_id, overrides? }`. Implemented pure TS over embedded `recipes/*.json`. Does not talk to the bridge for listing; `apply_recipe` calls the bridge via runner.

## 31. `push.set_pad_color` / `push.set_button_led` (Cycle 10, Phase 6, ADR-0008)

MIDI Sysex for Push 2/3 LEDs.
- pad: 0..63 (8x8 grid). color: 0..127.
- button: enum (`Play`, `Record`, `Stop`, `Tap Tempo`, `Metronome`, `Mute`, `Solo`, etc). mode: `"solid"` | `"blink"` | `"pulse"`.

`-32000` when Push is not detected (`detected: false`).

## Summary (after Cycle 10)

30 request/response JSON-RPC methods in the bridge (28 exposed + 2 system) + 7 `event.*` notifications (track/clip listeners).

The TS MCP server exposes **30 tools**:

| Category | MCP Tools |
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
| recipes (Track C) | list_recipes, apply_recipe |
| push (Phase 6) | push_set_pad_color, push_set_button_led |
| arrangement | arrangement_add_automation_point |
