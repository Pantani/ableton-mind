# ADR 0002 — `track.list` shape: collections em vez de indexes negativos

**Data:** 2026-06-08
**Status:** Aceito
**Autor:** architect
**Supersede:** parte de `_workspace/contracts/phase0-methods.md §6` (tabela `track.list` response)

## Contexto

Cycle 1 entregou `track.list` com indexing provisório:
- `index >= 0` → track regular
- `index = -1` → master
- `index = -2..-N` → return tracks

Documentado em TD-002 como débito. PLAN.md §4.2 lista master/return como entidades de primeira classe na LOM — Live as expõe via `song.tracks`, `song.return_tracks`, `song.master_track` (coleções separadas).

## Decisão

`track.list` agora devolve coleções separadas:

```ts
{
  tracks: TrackInfo[];          // só song.tracks (audio + MIDI + group)
  return_tracks: TrackInfo[];   // só song.return_tracks
  master_track: TrackInfo | null; // só song.master_track (sempre presente em runtime real, null em testes)
  total: number;                // sum(tracks) + sum(return_tracks) + (master_track ? 1 : 0)
}
```

`TrackInfo` perde os campos `is_return` e `is_master` (a coleção em que o objeto aparece já diz). Mantém:
- `index: number` (posição na própria coleção começando em 0)
- `name`, `color_index`
- `is_midi`, `is_audio`
- `mute`, `solo`, `arm` (master não tem arm; já documentado)
- `is_grouped`, `is_foldable`

## Por quê

- Alinha com LOM real do Live (`Song.tracks`, `Song.return_tracks`, `Song.master_track`).
- Acaba com a convenção mágica de indexes negativos (alvo de bugs em chamadas subsequentes — ex: `clip.create_midi` poderia receber `track_index=-1` por erro e tentaria criar clip no master).
- TypeScript fica mais expressivo (`master_track: TrackInfo | null` é checável).

## Consequências

- **Breaking change** vs Cycle 1, mas Phase 0 ainda em pré-release (v0.0.x) → aceito sem deprecation window.
- Atualizar contract `_workspace/contracts/phase0-methods.md §6` com nota apontando para este ADR.
- Atualizar Python handler `live/AbletonMind/handlers/track.py`.
- Atualizar testes Python afetados.
- TS tool `track_list` mapeia 1:1 (sem transformação extra).

## Como aplicar

- Implementado neste mesmo Cycle 2 (architect inline).
- Próximas tools que recebem track index (`clip.create_midi`, `track.set`, etc) continuam usando `track_index` como posição em `song.tracks` regulares — return/master são opted-in via prefixo (Phase 2+).
