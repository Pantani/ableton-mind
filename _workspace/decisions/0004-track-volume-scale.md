# ADR 0004 — Escala de `track.set_volume`

**Data:** 2026-06-09
**Status:** Aceito
**Autor:** architect

## Contexto

LiveAPI expõe `track.mixer_device.volume.value` como float 0.0..1.0 (normalized), onde 0.85 ~ 0 dB, 1.0 ~ +6 dB. dB não é linear no slider.

Wrappers de DAW (Reaper, Pro Tools API) costumam expor dB. ahujasid/ableton-mcp usa 0..1.

## Decisão

`track.set_volume` recebe `volume: number` em 0.0..1.0. **Não** aceita dB diretamente.

Adicional: tool retorna `volume_db_approx: number` calculado via conversão padrão (-inf, -60, ..., +6 dB) para LLM ter referência.

## Por quê

- Espelha LiveAPI 1:1 (sem conversão server-side dá precisão).
- Acordo de simplicidade do contrato JSON-RPC: 1 unidade por param.
- LLM pode pedir helper futuro `vol_from_db(-6)` em recipe — não bloqueante.

## Conversão `volume → dB` aproximada (Live curve)

| volume | dB    |
|--------|-------|
| 0.000  | -inf  |
| 0.200  | -42   |
| 0.400  | -22   |
| 0.600  | -10   |
| 0.700  | -4    |
| 0.850  |  0    |
| 1.000  | +6    |

Curva real do Live é piecewise (3 segmentos). Implementação Python aproxima com tabela + interpolação linear; aceita erro <0.5 dB. Phase 4 pode trocar por curva exata se necessário.

## Como aplicar

- `bridge/handlers/track.py::set_volume` clama 0..1, calcula dB aprox, chama `track.mixer_device.volume.value = v`.
- TS tool: Zod `z.number().min(0).max(1)`.
- Output: `{ ok, verified, changed, before: number, after: number, before_db: number, after_db: number }`.
