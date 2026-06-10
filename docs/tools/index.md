# Tools — 21 LOM domains

`ableton-mind` targets **~180 tools** across the 21 Live Object Model domains. Each tool is **idempotent**, **transactional**, **reversible**, **schema-aware**, and returns `{ ok, verified, diff }`.

> Full spec: [PLAN.md §4](https://github.com/Pantani/ableton-mind/blob/main/PLAN.md).

## Domains

| # | Domain | Example |
|---|---|---|
| 1 | `transport` | `play`, `set_tempo` |
| 2 | `track` | `track_list`, `track_create` |
| 3 | `clip` | `create_midi_clip` |
| 4 | `scene` | `scene_fire` |
| 5 | `device` | `device_set_param` |
| 6 | `rack` | `rack_set_macro` |
| 7 | `automation` | `automation_write` |
| 8 | `modulation` | `modulation_route` |
| 9 | `browser` | `browser_load` |
| 10 | `arrangement` | `arrangement_insert_clip` |
| 11 | `recording` | `recording_arm` |
| 12 | `mixer` | `mixer_set_volume` |
| 13 | `view` | `view_select_clip` |
| 14 | `session` | `session_trigger` |
| 15 | `groove` | `groove_apply` |
| 16 | `midi` | `midi_route` |
| 17 | `push` | `push_set_pad` |
| 18 | `introspection` | `state_snapshot` |
| 19 | `tuning` | `tuning_apply` |
| 20 | `cue` | `cue_add` |
| 21 | `live_set` | `live_set_info` |

## Current coverage (Cycle 24)

**36 MCP tools** implemented, including transport, session, track, clip, device, browser, scene, automation, preview, recipe, push, prompts, resources and Phase 8 read-only discovery. The target remains ~180 tools across the 21 LOM domains.
