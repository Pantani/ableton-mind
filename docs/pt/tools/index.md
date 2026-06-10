# Tools — 21 domínios LOM

`ableton-mind` planeja **~180 tools** cobrindo os 21 domínios do Live Object Model. Cada tool é **idempotente**, **transacional**, **reversível**, **schema-aware**, e retorna `{ ok, verified, diff }`.

> Spec completa: [PLAN.md §4](https://github.com/Pantani/ableton-mind/blob/main/PLAN.md).

## Domínios

| # | Domínio | Cobertura | Exemplo |
|---|---|---|---|
| 1 | `transport` | play, stop, tempo, metronome, loop, position | `play`, `set_tempo` |
| 2 | `track` | criar, deletar, renomear, mover, group, freeze | `track_list`, `track_create` |
| 3 | `clip` | MIDI/audio, notes, warp, loop, quantize | `create_midi_clip` |
| 4 | `scene` | criar, capturar, disparar, color | `scene_fire` |
| 5 | `device` | inserir, remover, mover, preset, params | `device_set_param` |
| 6 | `rack` | macro mapping, chains, zones | `rack_set_macro` |
| 7 | `automation` | envelopes, breakpoints, modos | `automation_write` |
| 8 | `modulation` | LFOs, MaxForLive modulators | `modulation_route` |
| 9 | `browser` | navegar packs, drag-in samples/presets | `browser_load` |
| 10 | `arrangement` | inserir, duplicar, time selection, render | `arrangement_insert_clip` |
| 11 | `recording` | arm, count-in, overdub, take lanes | `recording_arm` |
| 12 | `mixer` | volume, pan, sends, EQ8, comp | `mixer_set_volume` |
| 13 | `view` | selecionar track/clip/device, follow, detail | `view_select_clip` |
| 14 | `session` | clip slots, follow actions, legato | `session_trigger` |
| 15 | `groove` | groove pool, apply, commit | `groove_apply` |
| 16 | `midi` | input/output map, channels, CC | `midi_route` |
| 17 | `push` | pad, button, mode, color (1/2/3) | `push_set_pad` |
| 18 | `introspection` | song state, snapshots, diffs | `state_snapshot` |
| 19 | `tuning` | scales, tuning systems, microtonal | `tuning_apply` |
| 20 | `cue` | cue points, locators, tempo events | `cue_add` |
| 21 | `live_set` | save, load, new, metadata | `live_set_info` |

## Cobertura atual (Cycle 23)

**33 tools MCP** implementadas, incluindo transport, session, track, clip, device, browser, scene, automation, preview, recipe, push, prompts e resources. A meta continua sendo ~180 tools nos 21 dominios LOM.

## Como uma tool é declarada

Cada tool tem:

- **Zod schema** de input/output.
- **Verify step** — re-lê o LOM e diffa.
- **Undo step** — `Song.begin_undo_step()` / `end_undo_step()`.
- **Knowledge ref** — quando age sobre device, valida params via `src/knowledge/devices/`.

Detalhes de design em [Arquitetura](../architecture).
