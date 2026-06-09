# ADR 0006 — Automation envelope shape

**Data:** 2026-06-09
**Status:** Aceito
**Autor:** architect

## Contexto

Phase 4 do PLAN.md exige cobertura completa de automation (clip envelopes + arrangement envelopes). LiveAPI expõe:
- `clip.create_automation_envelope(parameter)` → `Live.ClipEnvelope`
- `clip_envelope.value_at_time(time)` / `insert_step(time, length, value)`
- `arrangement_automation` via `track.automation_envelopes` + `envelope.insert_step` / `envelope.value_at_time`

LLM precisa expressar pontos sem conhecer o tipo interno. Definimos formato canônico.

## Decisão

### 1. Envelope shape (request)

```ts
{
  parameter_path: string;     // ex: "mixer.volume", "mixer.panning",
                              //     "mixer.send.0", "device.0.Frequency"
  points: Array<{
    time: number;             // beats from clip start (clip env) ou
                              // beats from song start (arrangement env)
    value: number;            // sem normalização — usa o range nativo do param
    curve_type?: "linear" | "ramp" | "hold";  // default "linear"
  }>;
}
```

### 2. `parameter_path` resolution

Regras (a serem implementadas no lado TS):
- `"mixer.volume"` / `"mixer.panning"` / `"mixer.send.<i>"` → `track.mixer_device.volume` / etc.
- `"device.<i>.<param_name>"` → resolve `<param_name>` via `device.get_parameters` + knowledge enrichment.
- `"device.<i>.parameter.<index>"` → bypass resolution, usa index direto.

Path inválido → erro `-32008` (KNOWLEDGE_LOOKUP_FAILED).

### 3. Replace vs append

`clip.envelope_set_points` substitui TODOS os pontos do envelope. Não há `add_point` em clip envelopes (Phase 4 strict — appendar é gerenciado pelo bridge se necessário).

`arrangement.add_automation_point` é singular (adiciona 1 ponto sem replace).

### 4. Tempo

- Clip envelopes usam beats desde t=0 do clip.
- Arrangement envelopes usam beats desde t=0 da song.
- Sem suporte para clipes warpados ainda (Phase 5).

### 5. Quantização

Sem snap automático. LLM controla snap via valores escolhidos. Phase 5 pode adicionar `snap_to_grid: boolean`.

### 6. Curve types

LiveAPI suporta apenas linear nativamente em `insert_step`. Curve types adicionais:
- `"ramp"`: equivalente a linear no Live atual.
- `"hold"`: implementado como 2 pontos (atual_value até time, novo_value depois).

Phase 5 pode adicionar curve segments com expoente.

## Consequências

- Handler Python `clip.envelope_set_points` precisa: resolver parameter_path → DeviceParameter, criar envelope se não existe, clear() pontos atuais, inserir novos.
- Handler Python `arrangement.add_automation_point` precisa: get arrangement automation envelope, insert step.
- TS tool: validação de path via regex + lookup via knowledge.
- Recipes futuras consomem este formato.

## Como aplicar

- `handlers/clip.py::ClipEnvelopeSetPointsHandler` — Cycle 7.
- `handlers/arrangement.py::ArrangementAddAutomationPointHandler` NEW file — Cycle 7.
- `src/tools/clip.ts::clipSetEnvelopeTool` — Cycle 7.
- `src/tools/arrangement.ts::arrangementAddAutomationPointTool` NEW file — Cycle 7.
- Testes ficam para Cycle 8 (consistente com padrão "code first, tests next cycle").
