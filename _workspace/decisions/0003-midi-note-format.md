# ADR 0003 — Formato canônico de MIDI note

**Data:** 2026-06-09
**Status:** Aceito
**Autor:** architect

## Contexto

`clip.add_notes` precisa receber notas do LLM e converter para chamadas LiveAPI. Live 11+ tem `Live.Clip.Clip.add_new_notes(specification: NoteSpecification)` aceitando `{pitch, start_time, duration, velocity, mute}` (e per-note expression em Live 12 via API separada).

## Decisão

Formato JSON canônico de uma nota MIDI:

```ts
{
  pitch: number;     // 0..127, integer (Middle C = 60, A4 = 69)
  start: number;     // beats from clip start (0 = primeiro beat)
  duration: number;  // beats; > 0
  velocity?: number; // 0..127 integer; default 100
  mute?: boolean;    // default false
}
```

Array de notas é o `notes: NoteSpec[]` do request.

## Por quê

- `pitch`/`velocity` 0..127 (não MIDI hex, não nome de nota) — único formato sem ambiguidade enharmônica.
- `start`/`duration` em beats (não ticks, não segundos) — alinha com clip length e tempo.
- `mute` exposto porque LLMs querem ghost notes para drum patterns.

## Out of scope (Phase 4)

- Per-note CC (MPE) — Live 12 expõe; adiamos.
- Probability — Live 11+ adiciona; adiamos.
- Release velocity — raro; adiamos.

## Como aplicar

- `bridge/handlers/clip.py::add_notes` itera, valida 0<=pitch<=127, 0<=velocity<=127, duration>0, e chama `clip.add_new_notes`.
- TS tool `clip_add_notes` define Zod schema 1:1.
- Knowledge base eventualmente expõe helper `pitch_from_name("C4")` para LLMs que mandam nome — fora do escopo deste Cycle.
