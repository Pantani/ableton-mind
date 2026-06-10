# Knowledge base — schema convention

Static JSON files consumed by the loader in `src/knowledge/index.ts` (Zod-validated).

## Structure

```
src/knowledge/
├─ index.ts                # loader + Zod schemas
├─ scales.json             # 16 scales + 12 root notes
├─ discovery.json          # compact Phase 8 discovery labels
├─ devices/
│  ├─ <id>.json            # 1 file per native Live device
│  └─ _extracted/          # output from scripts/extract-device-schemas.mjs (not distributed)
└─ README.md               # this file
```

## Device schema

```jsonc
{
  "$schema": "../device-schema.json",
  "id": "ableton.<slug>",
  "name": "Wavetable",
  "category": "instrument | audio_effect | midi_effect | drum_rack | rack",
  "vendor": "Ableton",
  "live_version_min": "10.0",      // semver string; tools can filter
  "description": "...",
  "source": "curated (Cycle N)",   // or "extracted-from-default-adv (sha256:...)"
  "completeness": "partial | complete | stub",
  "parameters": [
    { "index": 0, "name": "...", "min": 0, "max": 1, "default": 0.5, ... }
  ],
  "modulation_matrix": { ... },     // optional, only instruments with a mod matrix
  "todo": []
}
```

`.passthrough()` in the Zod schema allows extra device-specific fields
(for example, `drum_pads` in `drum_rack.json`).

## `unit` Convention (TD-041)

LLMs need to know **how to interpret `value`** when calling `device_set_parameter`. Canonical list:

| Unit | Meaning | Typical range | Example |
|---|---|---|---|
| `linear` | Raw linear value (exactly mirrors the Live UI slider) | 0..1 or -1..1 | Normalized volume |
| `curve` | Raw 0..1 value mapped to an **internal nonlinear curve** (Drive, Amount, Color, etc.). 0.5 is not audibly half; it is only the slider midpoint | 0..1 | Drum Buss Drive, Pedal Gain |
| `Hz` | Frequency in Hertz | 20..22000 | Filter Frequency |
| `dB` | Decibels | -36..36 (variable) | Output Gain |
| `s` | Seconds | 0..60 | Envelope Attack |
| `ms` | Milliseconds | 0..1000 | Compressor Attack |
| `semitones`, `cents`, `octaves` | Pitch | -48..48 / -50..50 / -2..2 | Osc Transpose |
| `MIDI` | MIDI note number (0..127) | 0..127 | Pitch Tracking Note |
| `°` | Degrees (phase, stereo image) | 0..360 or 0..120 | LFO Phase |
| `Q` | Filter Q factor | 0.1..18 | EQ Resonance |
| `%` | Percent | 0..100 or -100..100 | Filter Env Amount |
| `BPM` | Tempo | 20..999 | Looper Tempo |
| `bits` | Resolution | 1..16 | Redux Bit Depth |
| `voices`, `count` | Discrete count | 1..32 | Polyphony |
| `bool` | 0 or 1 | 0..1 | On/Off switches |
| `enum` | Discrete choice index. `description` lists the options | 0..N | Filter Type |
| `ratio` | Multiplier (FM ratios) | 0.0625..32 | Operator A Coarse |

### When to Use `linear` vs `curve`

- **`linear`**: the user clicks a slider point and the engine receives that value with no significant transformation. Examples: pan (-1..1), volume (0..1 before the dB curve), Dry/Wet (0..1).
- **`curve`**: the visual range is 0..1 but the engine applies a logarithmic, exponential or polynomial curve. Example: Drum Buss Drive; 0.5 on the slider produces far less than half of maximum audible drive because the curve steepens near the end.

The LLM should assume that **raising Drive/Amount from 0.5 to 0.8 is not "60% more drive"**; it is "a few more dB of drive according to the curve". For audible fine-tuning, vary by 0.05 per call.

## Add a New Device

1. `node scripts/extract-device-schemas.mjs --device <Name>` (if a saved `.adv` exists)
2. The curator reviews output in `_extracted/`, completes `min/max/unit`, and chooses `linear` or `curve` as described above.
3. Move it to `devices/<slug>.json`.
4. Add `<slug>` to `KNOWN_DEVICES` in `index.ts`.
5. The test in `tests/distribution-validation.test.ts` validates it through `loadAllDevices()`.

## Scales

`scales.json` follows a simple format: 16 scales + 12 root notes (intervals in semitones from root).

The LLM can combine this with `session.get_info`, which returns Live's `root_note` and `scale_name`, to generate notes inside the current scale.

## Phase 8 Discovery Labels

`discovery.json` is intentionally small. It defines canonical labels for the
read-only Phase 8 discovery slice: plug-in/device formats, Max for Live
inspection capabilities, and Ableton Link status fields.

Do not expand it into a catalog of third-party plug-ins, Max devices, or remote
DAW integrations. Those are runtime facts and belong in bridge/tool responses.
