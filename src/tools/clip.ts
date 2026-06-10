/**
 * MCP tools for the Clip domain.
 *
 * Cycle 2: `create_midi_clip`.
 * Cycle 3 add: `clip_add_notes`, `clip_fire`, `clip_stop`, `clip_set_name`.
 *
 * Canonical MIDI note format defined in ADR-0003.
 */

import { z } from "zod";

import { UNVERIFIABLE, verifyAll, verifyField } from "../feedback/verify.js";
import { defineTool } from "../server/define-tool.js";

// ----- create_midi_clip ------------------------------------------------------

const createMidiClipInputSchema = z.object({
  track_index: z.number().int().nonnegative(),
  clip_slot_index: z.number().int().nonnegative(),
  length_beats: z.number().positive(),
  name: z.string().min(1).optional(),
});

const createMidiClipOutputSchema = z.object({
  ok: z.literal(true),
  verified: z.boolean(),
  changed: z.literal(true),
  clip: z.object({
    track_index: z.number().int().nonnegative(),
    clip_slot_index: z.number().int().nonnegative(),
    name: z.string(),
    length_beats: z.number(),
  }),
  diff: z
    .object({
      field: z.string(),
      intent: z.unknown(),
      actual: z.unknown(),
      tolerance: z.number().optional(),
    })
    .nullable(),
});

const createMidiClipBridgeResult = createMidiClipOutputSchema.pick({ changed: true, clip: true });

export const createMidiClipTool = defineTool({
  name: "create_midi_clip",
  description:
    "Create an empty MIDI clip in a session clip slot. Wrapped in an undo step. Verified via length match.",
  input: createMidiClipInputSchema,
  output: createMidiClipOutputSchema,
  handler: async (input, ctx) => {
    const raw = await ctx.bridge.call("clip.create_midi", {
      track_index: input.track_index,
      clip_slot_index: input.clip_slot_index,
      length_beats: input.length_beats,
      name: input.name,
    });
    const parsed = createMidiClipBridgeResult.parse(raw);
    const vLen = verifyField(input.length_beats, parsed.clip.length_beats, {
      tolerance: 1e-3,
      field: "length_beats",
    });
    const vName = input.name
      ? verifyField(input.name, parsed.clip.name, { field: "name" })
      : UNVERIFIABLE;
    const v = verifyAll(vLen, vName);
    return { ok: true as const, verified: v.ok, ...parsed, diff: v.diff };
  },
});

// ----- clip_add_notes (ADR-0003) ---------------------------------------------

const noteSchema = z.object({
  pitch: z.number().int().min(0).max(127),
  start: z.number().nonnegative().describe("Beats from clip start."),
  duration: z.number().positive().describe("Beats."),
  velocity: z.number().int().min(0).max(127).optional(),
  mute: z.boolean().optional(),
});

const clipAddNotesInputSchema = z.object({
  track_index: z.number().int().nonnegative(),
  clip_slot_index: z.number().int().nonnegative(),
  notes: z.array(noteSchema).min(1),
});

const clipAddNotesOutputSchema = z.object({
  ok: z.literal(true),
  verified: z.boolean(),
  changed: z.literal(true),
  added: z.number().int().nonnegative(),
  track_index: z.number().int().nonnegative(),
  clip_slot_index: z.number().int().nonnegative(),
  diff: z
    .object({
      field: z.string(),
      intent: z.unknown(),
      actual: z.unknown(),
      tolerance: z.number().optional(),
    })
    .nullable(),
});

const clipAddNotesBridgeResult = z.object({
  changed: z.literal(true),
  added: z.number().int().nonnegative(),
  track_index: z.number().int().nonnegative(),
  clip_slot_index: z.number().int().nonnegative(),
});

export const clipAddNotesTool = defineTool({
  name: "clip_add_notes",
  description:
    "Add MIDI notes to an existing clip. NOT idempotent — repeated calls append. ADR-0003 note format. Verified via note count.",
  input: clipAddNotesInputSchema,
  output: clipAddNotesOutputSchema,
  handler: async (input, ctx) => {
    const raw = await ctx.bridge.call("clip.add_notes", {
      track_index: input.track_index,
      clip_slot_index: input.clip_slot_index,
      notes: input.notes,
    });
    const parsed = clipAddNotesBridgeResult.parse(raw);
    const v = verifyField(input.notes.length, parsed.added, { field: "added" });
    return { ok: true as const, verified: v.ok, ...parsed, diff: v.diff };
  },
});

// ----- clip_fire -------------------------------------------------------------

const clipSlotRefSchema = z.object({
  track_index: z.number().int().nonnegative(),
  clip_slot_index: z.number().int().nonnegative(),
});

const clipFireOutputSchema = z.object({
  ok: z.literal(true),
  verified: z.boolean(),
  changed: z.boolean(),
  is_playing: z.boolean(),
  track_index: z.number().int().nonnegative(),
  clip_slot_index: z.number().int().nonnegative(),
  diff: z
    .object({
      field: z.string(),
      intent: z.unknown(),
      actual: z.unknown(),
      tolerance: z.number().optional(),
    })
    .nullable(),
});

const clipFireBridgeResult = z.object({
  changed: z.boolean(),
  is_playing: z.boolean(),
  track_index: z.number().int().nonnegative(),
  clip_slot_index: z.number().int().nonnegative(),
});

export const clipFireTool = defineTool({
  name: "clip_fire",
  description: "Trigger a session clip slot. Idempotent: changed=false if already playing.",
  input: clipSlotRefSchema,
  output: clipFireOutputSchema,
  handler: async (input, ctx) => {
    const raw = await ctx.bridge.call("clip.fire", {
      track_index: input.track_index,
      clip_slot_index: input.clip_slot_index,
    });
    const parsed = clipFireBridgeResult.parse(raw);
    // is_playing oscilates async per transport; mark UNVERIFIABLE.
    return { ok: true as const, verified: UNVERIFIABLE.ok, ...parsed, diff: UNVERIFIABLE.diff };
  },
});

// ----- clip_stop -------------------------------------------------------------

export const clipStopTool = defineTool({
  name: "clip_stop",
  description: "Stop a playing session clip. Idempotent.",
  input: clipSlotRefSchema,
  output: clipFireOutputSchema,
  handler: async (input, ctx) => {
    const raw = await ctx.bridge.call("clip.stop", {
      track_index: input.track_index,
      clip_slot_index: input.clip_slot_index,
    });
    const parsed = clipFireBridgeResult.parse(raw);
    // is_playing oscilates async per transport; mark UNVERIFIABLE.
    return { ok: true as const, verified: UNVERIFIABLE.ok, ...parsed, diff: UNVERIFIABLE.diff };
  },
});

// ----- clip_set_name ---------------------------------------------------------

const clipSetNameInputSchema = z.object({
  track_index: z.number().int().nonnegative(),
  clip_slot_index: z.number().int().nonnegative(),
  name: z.string().min(1),
});

const clipSetNameOutputSchema = z.object({
  ok: z.literal(true),
  verified: z.boolean(),
  changed: z.boolean(),
  before: z.string(),
  after: z.string(),
  diff: z
    .object({
      field: z.string(),
      intent: z.unknown(),
      actual: z.unknown(),
      tolerance: z.number().optional(),
    })
    .nullable(),
});

const clipSetNameBridgeResult = z.object({
  changed: z.boolean(),
  before: z.string(),
  after: z.string(),
});

export const clipSetNameTool = defineTool({
  name: "clip_set_name",
  description: "Rename a clip. Idempotent. Verified via read-after-write.",
  input: clipSetNameInputSchema,
  output: clipSetNameOutputSchema,
  handler: async (input, ctx) => {
    const raw = await ctx.bridge.call("clip.set_name", {
      track_index: input.track_index,
      clip_slot_index: input.clip_slot_index,
      name: input.name,
    });
    const parsed = clipSetNameBridgeResult.parse(raw);
    const v = verifyField(input.name, parsed.after, { field: "name" });
    return { ok: true as const, verified: v.ok, ...parsed, diff: v.diff };
  },
});

// ----- clip_set_loop ---------------------------------------------------------

const clipSetLoopInputSchema = z.object({
  track_index: z.number().int().nonnegative(),
  clip_slot_index: z.number().int().nonnegative(),
  loop_start: z.number().nonnegative().optional(),
  loop_end: z.number().positive().optional(),
  looping: z.boolean().optional(),
});

const loopStateSchema = z.object({
  loop_start: z.number(),
  loop_end: z.number(),
  looping: z.boolean(),
});

const clipSetLoopOutputSchema = z.object({
  ok: z.literal(true),
  verified: z.boolean(),
  changed: z.boolean(),
  before: loopStateSchema,
  after: loopStateSchema,
  diff: z
    .object({
      field: z.string(),
      intent: z.unknown(),
      actual: z.unknown(),
      tolerance: z.number().optional(),
    })
    .nullable(),
});

const clipSetLoopBridgeResult = z.object({
  changed: z.boolean(),
  before: loopStateSchema,
  after: loopStateSchema,
});

// ----- clip_set_envelope (Phase 4 — ADR-0006) --------------------------------

import { parameterPathSchema, parseParameterLocator } from "./_locator.js";

const envelopePointSchema = z.object({
  time: z.number().nonnegative().describe("Beats from clip start."),
  value: z.number(),
  curve_type: z.enum(["linear", "ramp", "hold"]).optional(),
});

const clipSetEnvelopeInputSchema = z.object({
  track_index: z.number().int().nonnegative(),
  clip_slot_index: z.number().int().nonnegative(),
  parameter_path: parameterPathSchema,
  points: z.array(envelopePointSchema),
});

const clipSetEnvelopeOutputSchema = z.object({
  ok: z.literal(true),
  verified: z.boolean(),
  changed: z.literal(true),
  replaced: z.boolean(),
  points: z.number().int().nonnegative(),
  track_index: z.number().int().nonnegative(),
  clip_slot_index: z.number().int().nonnegative(),
  diff: z
    .object({
      field: z.string(),
      intent: z.unknown(),
      actual: z.unknown(),
      tolerance: z.number().optional(),
    })
    .nullable(),
});

const clipSetEnvelopeBridgeResult = z.object({
  changed: z.literal(true),
  replaced: z.boolean(),
  points: z.number().int().nonnegative(),
  track_index: z.number().int().nonnegative(),
  clip_slot_index: z.number().int().nonnegative(),
});

export const clipSetEnvelopeTool = defineTool({
  name: "clip_set_envelope",
  description:
    "Replace all automation points of a clip envelope. parameter_path: 'mixer.volume' | 'device.<i>.parameter.<n>'. Verified via point count match.",
  input: clipSetEnvelopeInputSchema,
  output: clipSetEnvelopeOutputSchema,
  handler: async (input, ctx) => {
    const locator = parseParameterLocator(input.parameter_path);
    const raw = await ctx.bridge.call("clip.envelope_set_points", {
      track_index: input.track_index,
      clip_slot_index: input.clip_slot_index,
      parameter_locator: locator,
      points: input.points,
    });
    const parsed = clipSetEnvelopeBridgeResult.parse(raw);
    // TD-023: `hold` curve_type inserts 2 points in the bridge per LLM point
    // (one leading edge + the point itself). We compute the expected total.
    const expectedCount = input.points.reduce(
      (acc, p, i) => acc + (p.curve_type === "hold" && i > 0 ? 2 : 1),
      0,
    );
    const v = verifyField(expectedCount, parsed.points, { field: "points" });
    return { ok: true as const, verified: v.ok, ...parsed, diff: v.diff };
  },
});

export const clipSetLoopTool = defineTool({
  name: "clip_set_loop",
  description:
    "Configure a clip's loop_start / loop_end / looping flag. Any field omitted is preserved. Idempotent within 1e-4. Verified via after match.",
  input: clipSetLoopInputSchema,
  output: clipSetLoopOutputSchema,
  handler: async (input, ctx) => {
    const raw = await ctx.bridge.call("clip.set_loop", {
      track_index: input.track_index,
      clip_slot_index: input.clip_slot_index,
      loop_start: input.loop_start,
      loop_end: input.loop_end,
      looping: input.looping,
    });
    const parsed = clipSetLoopBridgeResult.parse(raw);
    // Only verify fields that the LLM passed.
    const checks = [
      input.loop_start !== undefined
        ? verifyField(input.loop_start, parsed.after.loop_start, {
            tolerance: 1e-4,
            field: "loop_start",
          })
        : UNVERIFIABLE,
      input.loop_end !== undefined
        ? verifyField(input.loop_end, parsed.after.loop_end, { tolerance: 1e-4, field: "loop_end" })
        : UNVERIFIABLE,
      input.looping !== undefined
        ? verifyField(input.looping, parsed.after.looping, { field: "looping" })
        : UNVERIFIABLE,
    ];
    const v = verifyAll(...checks);
    return { ok: true as const, verified: v.ok, ...parsed, diff: v.diff };
  },
});
