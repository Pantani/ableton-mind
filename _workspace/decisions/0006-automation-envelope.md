# ADR 0006 — Automation envelope shape

**Date:** 2026-06-09
**Status:** Accepted
**Author:** architect

## Context

PLAN.md Phase 4 requires full automation coverage (clip envelopes + arrangement envelopes). LiveAPI exposes:
- `clip.create_automation_envelope(parameter)` → `Live.ClipEnvelope`
- `clip_envelope.value_at_time(time)` / `insert_step(time, length, value)`
- `arrangement_automation` via `track.automation_envelopes` + `envelope.insert_step` / `envelope.value_at_time`

The LLM needs to express points without knowing the internal type. We define a canonical format.

## Decision

### 1. Envelope shape (request)

```ts
{
  parameter_path: string;     // e.g.: "mixer.volume", "mixer.panning",
                              //       "mixer.send.0", "device.0.Frequency"
  points: Array<{
    time: number;             // beats from clip start (clip env) or
                              // beats from song start (arrangement env)
    value: number;            // without normalization — uses the param's native range
    curve_type?: "linear" | "ramp" | "hold";  // default "linear"
  }>;
}
```

### 2. `parameter_path` resolution

Rules (to be implemented on the TS side):
- `"mixer.volume"` / `"mixer.panning"` / `"mixer.send.<i>"` → `track.mixer_device.volume` / etc.
- `"device.<i>.<param_name>"` → resolves `<param_name>` via `device.get_parameters` + knowledge enrichment.
- `"device.<i>.parameter.<index>"` → bypass resolution, uses index directly.

Invalid path → `-32008` error (KNOWLEDGE_LOOKUP_FAILED).

### 3. Replace vs append

`clip.envelope_set_points` replaces ALL points of the envelope. There is no `add_point` for clip envelopes (Phase 4 strict — appending is managed by the bridge if necessary).

`arrangement.add_automation_point` is singular (adds 1 point without replace).

### 4. Time

- Clip envelopes use beats since t=0 of the clip.
- Arrangement envelopes use beats since t=0 of the song.
- No support for warped clips yet (Phase 5).

### 5. Quantization

No automatic snap. The LLM controls snap via chosen values. Phase 5 may add `snap_to_grid: boolean`.

### 6. Curve types

LiveAPI supports only linear natively in `insert_step`. Additional curve types:
- `"ramp"`: equivalent to linear in current Live.
- `"hold"`: implemented as 2 points (current_value until time, new_value afterwards).

Phase 5 may add curve segments with an exponent.

## Consequences

- The Python `clip.envelope_set_points` handler needs to: resolve parameter_path → DeviceParameter, create envelope if it does not exist, clear() current points, insert new ones.
- The Python `arrangement.add_automation_point` handler needs to: get arrangement automation envelope, insert step.
- TS tool: path validation via regex + lookup via knowledge.
- Future recipes consume this format.

## How to apply

- `handlers/clip.py::ClipEnvelopeSetPointsHandler` — Cycle 7.
- `handlers/arrangement.py::ArrangementAddAutomationPointHandler` NEW file — Cycle 7.
- `src/tools/clip.ts::clipSetEnvelopeTool` — Cycle 7.
- `src/tools/arrangement.ts::arrangementAddAutomationPointTool` NEW file — Cycle 7.
- Tests deferred to Cycle 8 (consistent with the "code first, tests next cycle" pattern).
