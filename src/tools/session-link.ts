/**
 * Phase 8 read-only Ableton Link / remote sync discovery.
 */

import { z } from "zod";

import { defineTool } from "../server/define-tool.js";

const inputSchema = z.object({}).strict();

const linkStatusBridgeResult = z.object({
  available: z.boolean(),
  read_only: z.literal(true),
  source: z.enum(["song", "application", "mixed", "none"]),
  enabled: z.boolean().nullable(),
  is_connected: z.boolean().nullable(),
  num_peers: z.number().int().nonnegative().nullable(),
  start_stop_sync_enabled: z.boolean().nullable(),
  tempo_sync_enabled: z.boolean().nullable(),
  quantum: z.number().positive().nullable(),
  reason: z.string().nullable(),
  unsupported_attributes: z.array(z.string()),
});

const outputSchema = linkStatusBridgeResult.extend({
  ok: z.literal(true),
  verified: z.literal(true),
});

export const sessionLinkStatusTool = defineTool({
  name: "session_link_status",
  description:
    "Read-only Ableton Link and external sync status discovery. Use before sync-sensitive playback or collaboration workflows. Returns available=false with nullable status fields and a reason when the Live runtime does not expose Link state.",
  input: inputSchema,
  output: outputSchema,
  handler: async (_input, ctx) => {
    const raw = await ctx.bridge.call("session.link_status", {});
    const parsed = linkStatusBridgeResult.parse(raw);
    return outputSchema.parse({ ok: true as const, verified: true as const, ...parsed });
  },
});
