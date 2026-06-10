/**
 * MCP tools Phase 5 — session snapshot/diff + render preview.
 *
 * `session_snapshot` (read-only) → deep state of Live for the full verify loop.
 * `session_diff` receives the previous snapshot + reads the current one + returns changes.
 * `render_preview` mode "snapshot" returns an enriched session_snapshot.
 *   mode "bounce" planned for Cycle 10 (freeze + export).
 */

import { z } from "zod";

import { defineTool } from "../server/define-tool.js";

const trackSnapSchema = z.object({
  index: z.number().int().nonnegative(),
  name: z.string(),
  color_index: z.number().int(),
  is_midi: z.boolean(),
  is_audio: z.boolean(),
  mute: z.boolean(),
  solo: z.boolean(),
  arm: z.boolean(),
  volume: z.number(),
  panning: z.number(),
  clips: z
    .array(
      z.object({
        slot: z.number().int().nonnegative(),
        name: z.string(),
        length: z.number(),
        is_playing: z.boolean(),
      }),
    )
    .optional(),
  devices: z
    .array(
      z.object({
        index: z.number().int().nonnegative(),
        name: z.string(),
        class_name: z.string(),
      }),
    )
    .optional(),
});

const snapshotSchema = z.object({
  ts: z.number().int(),
  tempo: z.number(),
  is_playing: z.boolean(),
  song_time: z.number(),
  signature_numerator: z.number().int(),
  signature_denominator: z.number().int(),
  tracks: z.array(trackSnapSchema),
  total_tracks: z.number().int().nonnegative(),
});

// ----- session_snapshot ------------------------------------------------------

const snapInputSchema = z.object({
  include_clips: z.boolean().optional(),
  include_devices: z.boolean().optional(),
});

const snapOutputSchema = snapshotSchema.extend({
  ok: z.literal(true),
  verified: z.literal(true),
});

export const sessionSnapshotTool = defineTool({
  name: "session_snapshot",
  description:
    "Read-only deep snapshot of the Live session (tracks + clips + devices). Use before+after a mutation to verify changes via session_diff.",
  input: snapInputSchema,
  output: snapOutputSchema,
  handler: async (input, ctx) => {
    const raw = await ctx.bridge.call("session.snapshot", {
      include_clips: input.include_clips ?? true,
      include_devices: input.include_devices ?? true,
    });
    const parsed = snapshotSchema.parse(raw);
    return { ok: true as const, verified: true as const, ...parsed };
  },
});

// ----- session_diff ----------------------------------------------------------

const diffChangeSchema = z.object({
  path: z.string(),
  before: z.unknown().nullable(),
  after: z.unknown().nullable(),
  kind: z.enum(["added", "removed", "changed"]),
});

const diffInputSchema = z.object({
  previous: snapshotSchema,
});

const diffOutputSchema = z.object({
  ok: z.literal(true),
  verified: z.literal(true),
  from_ts: z.number().int(),
  to_ts: z.number().int(),
  changes: z.array(diffChangeSchema),
  count: z.number().int().nonnegative(),
});

const diffBridgeResult = diffOutputSchema.omit({ ok: true, verified: true });

export const sessionDiffTool = defineTool({
  name: "session_diff",
  description:
    "Diff between a previous session_snapshot and the current state. Returns list of changes with path + before + after.",
  input: diffInputSchema,
  output: diffOutputSchema,
  handler: async (input, ctx) => {
    const raw = await ctx.bridge.call("session.diff", { previous: input.previous });
    const parsed = diffBridgeResult.parse(raw);
    return { ok: true as const, verified: true as const, ...parsed };
  },
});

// ----- render_preview --------------------------------------------------------

const previewInputSchema = z.object({
  mode: z.enum(["snapshot", "bounce"]).optional(),
  bars: z.number().int().positive().optional(),
});

const previewOutputSchema = z.object({
  ok: z.literal(true),
  verified: z.literal(true),
  mode: z.enum(["snapshot", "bounce"]),
  snapshot: snapshotSchema.optional(),
  bars: z.number().int().positive(),
});

const previewBridgeResult = z.object({
  mode: z.enum(["snapshot", "bounce"]),
  snapshot: snapshotSchema.optional(),
  bars: z.number().int().positive(),
});

export const renderPreviewTool = defineTool({
  name: "render_preview",
  description:
    "Preview the current state. Mode 'snapshot' (default) returns deep state without audio. Mode 'bounce' (Cycle 10) renders 8-bar bounce.",
  input: previewInputSchema,
  output: previewOutputSchema,
  handler: async (input, ctx) => {
    const raw = await ctx.bridge.call("render.preview", {
      mode: input.mode ?? "snapshot",
      bars: input.bars ?? 8,
    });
    const parsed = previewBridgeResult.parse(raw);
    return { ok: true as const, verified: true as const, ...parsed };
  },
});
