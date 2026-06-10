/**
 * MCP tools for the Transport domain.
 *
 * Phase 0 strict had only `play`. Cycle 2 added `stop` and `set_tempo`.
 * All map 1:1 to `transport.*` handlers in the Python bridge (contract
 * in `_workspace/contracts/phase0-methods.md`).
 */

import { z } from "zod";

import { UNVERIFIABLE, verifyField } from "../feedback/verify.js";
import { defineTool } from "../server/define-tool.js";

// ----- play ------------------------------------------------------------------

const playInputSchema = z.object({
  from_beginning: z
    .boolean()
    .optional()
    .describe("If true, restarts the song from the beginning. Default false (continues)."),
});

const playOutputSchema = z.object({
  ok: z.literal(true),
  verified: z.boolean(),
  changed: z.boolean(),
  is_playing: z.boolean(),
  current_song_time: z.number(),
  diff: z
    .object({
      field: z.string(),
      intent: z.unknown(),
      actual: z.unknown(),
      tolerance: z.number().optional(),
    })
    .nullable(),
});

const playBridgeResult = z.object({
  changed: z.boolean(),
  is_playing: z.boolean(),
  current_song_time: z.number(),
});

export const playTool = defineTool({
  name: "play",
  description:
    "Start (or continue) Ableton Live playback. Idempotent: if already playing, returns changed=false. Marked UNVERIFIABLE — transport state oscilates async.",
  input: playInputSchema,
  output: playOutputSchema,
  handler: async (input, ctx) => {
    const raw = await ctx.bridge.call("transport.play", {
      from_beginning: input.from_beginning ?? false,
    });
    const parsed = playBridgeResult.parse(raw);
    return {
      ok: true as const,
      verified: UNVERIFIABLE.ok,
      ...parsed,
      diff: UNVERIFIABLE.diff,
    };
  },
});

// ----- stop ------------------------------------------------------------------

const stopInputSchema = z.object({}).strict();

const stopOutputSchema = z.object({
  ok: z.literal(true),
  verified: z.boolean(),
  changed: z.boolean(),
  is_playing: z.literal(false),
  current_song_time: z.number(),
  diff: z
    .object({
      field: z.string(),
      intent: z.unknown(),
      actual: z.unknown(),
      tolerance: z.number().optional(),
    })
    .nullable(),
});

const stopBridgeResult = z.object({
  changed: z.boolean(),
  is_playing: z.boolean(),
  current_song_time: z.number(),
});

export const stopTool = defineTool({
  name: "stop",
  description: "Stop Ableton Live playback. Idempotent: if already stopped, returns changed=false.",
  input: stopInputSchema,
  output: stopOutputSchema,
  handler: async (_input, ctx) => {
    const raw = await ctx.bridge.call("transport.stop", {});
    const parsed = stopBridgeResult.parse(raw);
    return {
      ok: true as const,
      verified: UNVERIFIABLE.ok,
      changed: parsed.changed,
      is_playing: false as const,
      current_song_time: parsed.current_song_time,
      diff: UNVERIFIABLE.diff,
    };
  },
});

// ----- set_tempo -------------------------------------------------------------

const setTempoInputSchema = z.object({
  bpm: z.number().min(20).max(999).describe("Tempo in BPM. Live's valid range: 20–999."),
});

const setTempoOutputSchema = z.object({
  ok: z.literal(true),
  verified: z.boolean(),
  changed: z.boolean(),
  before: z.number(),
  after: z.number(),
  diff: z
    .object({
      field: z.string(),
      intent: z.unknown(),
      actual: z.unknown(),
      tolerance: z.number().optional(),
    })
    .nullable(),
});

const setTempoBridgeResult = z.object({
  changed: z.boolean(),
  before: z.number(),
  after: z.number(),
});

export const setTempoTool = defineTool({
  name: "set_tempo",
  description:
    "Set the global tempo (BPM) of the Ableton Live song. Idempotent within 0.001 BPM. Verified via read-after-write.",
  input: setTempoInputSchema,
  output: setTempoOutputSchema,
  handler: async (input, ctx) => {
    const raw = await ctx.bridge.call("transport.set_tempo", { bpm: input.bpm });
    const parsed = setTempoBridgeResult.parse(raw);
    const v = verifyField(input.bpm, parsed.after, { tolerance: 1e-3, field: "tempo" });
    return {
      ok: true as const,
      verified: v.ok,
      ...parsed,
      diff: v.diff,
    };
  },
});
