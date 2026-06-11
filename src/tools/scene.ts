/**
 * MCP tools for the Scene domain.
 *
 * `scene_fire` — fires a scene by index. Useful for arrangement-style
 * playback in Session view (scene plays everything on its row).
 */

import { z } from "zod";

import { UNVERIFIABLE } from "../feedback/verify.js";
import { defineTool } from "../server/define-tool.js";

const inputSchema = z.object({
  index: z.number().int().nonnegative(),
});

const outputSchema = z.object({
  ok: z.literal(true),
  verified: z.boolean(),
  changed: z.literal(true),
  index: z.number().int().nonnegative(),
  name: z.string(),
  diff: z
    .object({
      field: z.string(),
      intent: z.unknown(),
      actual: z.unknown(),
      tolerance: z.number().optional(),
    })
    .nullable(),
});

const bridgeResultSchema = z.object({
  changed: z.literal(true),
  index: z.number().int().nonnegative(),
  name: z.string(),
});

export const sceneFireTool = defineTool({
  name: "scene_fire",
  description:
    "Fire a Session view scene by index, triggering all clips on that row. Use for arrangement-style playback from scenes. NOT idempotent: re-triggering restarts clips; returns scene name and marks async transport verification unverified.",
  input: inputSchema,
  output: outputSchema,
  handler: async (input, ctx) => {
    const raw = await ctx.bridge.call("scene.fire", { index: input.index });
    const parsed = bridgeResultSchema.parse(raw);
    // scene.fire's effect (clips start playing) is async — can't be verified
    // synchronously. Marked as UNVERIFIABLE.
    return { ok: true as const, verified: UNVERIFIABLE.ok, ...parsed, diff: UNVERIFIABLE.diff };
  },
});
