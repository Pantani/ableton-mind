/**
 * Tools MCP do domínio Arrangement (Phase 4 start — ADR-0006).
 *
 * `arrangement_add_automation_point` — adiciona um ponto a um automation
 * envelope no arrangement view. NÃO idempotente.
 *
 * Resolução de `parameter_path` → `parameter_locator` (formato que o bridge
 * entende) acontece aqui no lado TS.
 */

import { z } from "zod";

import { defineTool } from "../server/define-tool.js";

import { parameterPathSchema, parseParameterLocator } from "./_locator.js";

const inputSchema = z.object({
  track_index: z.number().int().nonnegative(),
  parameter_path: parameterPathSchema,
  time: z.number().nonnegative().describe("Beats from song start."),
  value: z.number(),
  curve_type: z.enum(["linear", "ramp", "hold"]).optional(),
});

const outputSchema = z.object({
  ok: z.literal(true),
  verified: z.literal(true),
  added: z.literal(true),
  track_index: z.number().int().nonnegative(),
  time: z.number(),
  value: z.number(),
  curve_type: z.string(),
});

const bridgeResultSchema = z.object({
  added: z.literal(true),
  track_index: z.number().int().nonnegative(),
  time: z.number(),
  value: z.number(),
  curve_type: z.string(),
});

export const arrangementAddAutomationPointTool = defineTool({
  name: "arrangement_add_automation_point",
  description:
    "Add an automation point in the Arrangement view. parameter_path: 'mixer.volume' | 'mixer.panning' | 'mixer.send.<i>' | 'device.<i>.parameter.<n>'. NOT idempotent.",
  input: inputSchema,
  output: outputSchema,
  handler: async (input, ctx) => {
    const locator = parseParameterLocator(input.parameter_path);
    const raw = await ctx.bridge.call("arrangement.add_automation_point", {
      track_index: input.track_index,
      parameter_locator: locator,
      time: input.time,
      value: input.value,
      curve_type: input.curve_type ?? "linear",
    });
    const parsed = bridgeResultSchema.parse(raw);
    return { ok: true as const, verified: true as const, ...parsed };
  },
});
