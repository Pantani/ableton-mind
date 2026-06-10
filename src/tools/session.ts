/**
 * MCP tools for the Session domain.
 *
 * `session_get_info` — read-only snapshot of top-level state. The LLM uses it
 * to orient itself before mutating.
 */

import { z } from "zod";

import { defineTool } from "../server/define-tool.js";

const inputSchema = z.object({}).strict();

const outputSchema = z.object({
  ok: z.literal(true),
  verified: z.literal(true),
  name: z.string(),
  num_tracks: z.number().int().nonnegative(),
  num_return_tracks: z.number().int().nonnegative(),
  has_master: z.boolean(),
  tempo: z.number(),
  time_signature: z.object({
    numerator: z.number().int().positive(),
    denominator: z.number().int().positive(),
  }),
  is_playing: z.boolean(),
  song_time: z.number(),
  song_length: z.number(),
  root_note: z.number().int().min(0).max(127),
  scale_name: z.string(),
});

const bridgeResultSchema = outputSchema.omit({ ok: true, verified: true });

export const sessionGetInfoTool = defineTool({
  name: "session_get_info",
  description:
    "Top-level read-only snapshot of the Live session: tempo, transport, time signature, track counts, root note, scale.",
  input: inputSchema,
  output: outputSchema,
  handler: async (_input, ctx) => {
    const raw = await ctx.bridge.call("session.get_info", {});
    const parsed = bridgeResultSchema.parse(raw);
    return { ok: true as const, verified: true as const, ...parsed };
  },
});
