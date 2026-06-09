# Cycle 9 — 2026-06-09

**Fase PLAN.md:** Phase 5 inicia (preview/snapshot/diff). Recipes (Trilha C) estreia.

**Objetivo:** TD-024/025, +5 devices, snapshot/diff handlers, recipe loader + 1ª recipe + `apply_recipe` tool, ADR-0007.

## Estratégia

Inline. Auto mode.

## Atribuições

### Trilha A — Bridge
1. TD-025: helper `live_api_with_listeners()` em `_fakes/` registra add_/remove_<prop>_listener para múltiplas props.
2. Phase 5 handlers:
   - `session.snapshot` — read deep state (tracks, clips meta, devices, tempo, transport).
   - `session.diff` — recebe snapshot anterior + lê atual + devolve diff.
   - `render.preview` — STUB (LiveAPI não tem render-to-file síncrono; usar `freeze_track` ou flatten; Cycle 10 vai integrar com export).

### Trilha A — Server TS
1. 3 tools: `session_snapshot`, `session_diff`, `render_preview`.
2. Recipe trilha: `src/recipes/index.ts` loader, `src/tools/recipe.ts` com `apply_recipe`, `list_recipes`.

### Trilha B — Knowledge
1. TD-024: Sampler completo (~80 params via curadoria).
2. +4 devices: Limiter, Glue Compressor, Bass, Drift (Hybrid Reverb fica Cycle 10 — é complexo).

### Trilha C — Recipes (estreia)
1. `recipes/drums/tech-house-kick.json` — recipe seed: cria MIDI track "Kick", adiciona Drum Cell, set params (Tune low, Decay short, Saturation), insere notes 4-to-floor.
2. ADR-0007 — formato canônico das recipes.

## Contratos

`session.snapshot` → `{ tempo, is_playing, time_signature, tracks: [...], total }`. Não inclui audio.

`session.diff` → `{ from_ts, to_ts, changes: [...] }`. Each change: `{ path, before, after, kind }`.

`render.preview` Phase 5 stub: `{ mode: "snapshot" }` → retorna `session.snapshot` enriquecido. Phase 5 real: `{ mode: "bounce", bars }` → `freeze_track` + path do .wav.

`apply_recipe` (ADR-0007 simplified):
- request: `{ recipe_id: string, params?: dict }` (ou `recipe: object`).
- response: `{ applied: true, steps: number, recipe_id }`.

## Critérios de gate

- [ ] TD-024/025 fechados.
- [ ] Phase 5: 3 handlers + 3 tools.
- [ ] Recipe loader + apply_recipe + 1 recipe.
- [ ] 5 devices (19 total).
- [ ] ADR-0007.

## Próximo

Cycle 10: smoke real, render_preview real (freeze→export), screenshot_live, +5 devices, +5 recipes.
