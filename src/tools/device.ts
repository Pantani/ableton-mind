/**
 * MCP tools for the Device domain. Knowledge-aware: uses `src/knowledge/devices/`
 * to resolve `parameter_name` → index when the LLM sends a human-readable name.
 *
 * `device_get_parameters` — read-only. Enriches response with `canonical_name`
 * from knowledge when matching by name or device class.
 *
 * `device_set_parameter` — accepts `parameter_name` OR `parameter_index`. If
 * only name is provided, looks it up in the `device.get_parameters` response
 * (1 round-trip) before calling `device.set_parameter`. Idempotent on the bridge side.
 */

import { z } from "zod";

import { verifyField } from "../feedback/verify.js";
import { type DeviceSchema, findParameter, loadAllDevices } from "../knowledge/index.js";
import { defineTool } from "../server/define-tool.js";

// ----- shared shapes ---------------------------------------------------------

const deviceParamSnapshotSchema = z.object({
  index: z.number().int().nonnegative(),
  name: z.string(),
  value: z.number(),
  min: z.number(),
  max: z.number(),
  is_quantized: z.boolean(),
  value_items: z.array(z.string()),
  automation_state: z.number().int(),
});

// ----- device_get_parameters -------------------------------------------------

const getParamsInputSchema = z.object({
  track_index: z.number().int().nonnegative(),
  device_index: z.number().int().nonnegative(),
});

const enrichedParamSchema = deviceParamSnapshotSchema.extend({
  /** Comes from knowledge: description, unit, etc. Null if device is not in knowledge. */
  knowledge: z
    .object({
      unit: z.string().optional(),
      description: z.string().optional(),
      automatable: z.boolean().optional(),
      modulatable: z.boolean().optional(),
    })
    .nullable(),
});

const getParamsOutputSchema = z.object({
  ok: z.literal(true),
  verified: z.literal(true),
  device_name: z.string(),
  class_name: z.string(),
  parameters: z.array(enrichedParamSchema),
  total: z.number().int().nonnegative(),
  knowledge_matched: z.boolean().describe("True if device was found in the knowledge base."),
});

const getParamsBridgeResult = z.object({
  device_name: z.string(),
  class_name: z.string(),
  parameters: z.array(deviceParamSnapshotSchema),
  total: z.number().int().nonnegative(),
});

/** Heuristic match: matches by exact `name` OR exact `class_name`. */
async function matchKnowledgeDevice(
  deviceName: string,
  className: string,
): Promise<DeviceSchema | null> {
  const all = await loadAllDevices().catch(() => [] as DeviceSchema[]);
  return (
    all.find(
      (d) =>
        d.name.toLowerCase() === deviceName.toLowerCase() ||
        d.name.toLowerCase() === className.toLowerCase(),
    ) ?? null
  );
}

export const deviceGetParametersTool = defineTool({
  name: "device_get_parameters",
  description:
    "List all parameters of a device (knowledge-aware: enriches with unit/description when device is in the knowledge base).",
  input: getParamsInputSchema,
  output: getParamsOutputSchema,
  handler: async (input, ctx) => {
    const raw = await ctx.bridge.call("device.get_parameters", input);
    const parsed = getParamsBridgeResult.parse(raw);
    const knowledge = await matchKnowledgeDevice(parsed.device_name, parsed.class_name);
    const enriched = parsed.parameters.map((p) => {
      const k = knowledge ? findParameter(knowledge, p.name) : null;
      return {
        ...p,
        knowledge: k
          ? {
              unit: k.unit,
              description: k.description,
              automatable: k.automatable,
              modulatable: k.modulatable,
            }
          : null,
      };
    });
    return {
      ok: true as const,
      verified: true as const,
      device_name: parsed.device_name,
      class_name: parsed.class_name,
      parameters: enriched,
      total: parsed.total,
      knowledge_matched: knowledge !== null,
    };
  },
});

// ----- device_set_parameter --------------------------------------------------

const setParamInputSchema = z
  .object({
    track_index: z.number().int().nonnegative(),
    device_index: z.number().int().nonnegative(),
    parameter_index: z.number().int().nonnegative().optional(),
    parameter_name: z.string().min(1).optional(),
    value: z.number(),
  })
  .refine((v) => v.parameter_index !== undefined || v.parameter_name !== undefined, {
    message: "either parameter_index or parameter_name must be provided",
  });

const setParamOutputSchema = z.object({
  ok: z.literal(true),
  verified: z.boolean(),
  changed: z.boolean(),
  name: z.string(),
  before: z.number(),
  after: z.number(),
  resolved_from: z.enum(["index", "name_via_bridge"]),
  diff: z
    .object({
      field: z.string(),
      intent: z.unknown(),
      actual: z.unknown(),
      tolerance: z.number().optional(),
    })
    .nullable(),
});

const setParamBridgeResult = z.object({
  changed: z.boolean(),
  name: z.string(),
  before: z.number(),
  after: z.number(),
});

export const deviceSetParameterTool = defineTool({
  name: "device_set_parameter",
  description:
    "Set a device parameter by `parameter_index` OR `parameter_name`. When name is used, looks up the index via device.get_parameters (1 extra bridge call). Idempotent within 1e-4 (or exact for quantized).",
  input: setParamInputSchema,
  output: setParamOutputSchema,
  handler: async (input, ctx) => {
    let index = input.parameter_index;
    let resolvedFrom: "index" | "name_via_bridge" = "index";

    if (index === undefined && input.parameter_name) {
      // Resolve via bridge get_parameters (knowledge alone doesn't know runtime indexes —
      // device order can differ from default presets). Authoritative source = live device.
      const list = await ctx.bridge.call("device.get_parameters", {
        track_index: input.track_index,
        device_index: input.device_index,
      });
      const parsed = getParamsBridgeResult.parse(list);
      const found = parsed.parameters.find(
        (p) => p.name.toLowerCase() === (input.parameter_name as string).toLowerCase(),
      );
      if (!found) {
        const names = parsed.parameters.map((p) => p.name);
        throw new Error(
          `parameter "${input.parameter_name}" not found on device "${parsed.device_name}". Available: ${names.slice(0, 12).join(", ")}${names.length > 12 ? ", ..." : ""}`,
        );
      }
      index = found.index;
      resolvedFrom = "name_via_bridge";
    }

    const raw = await ctx.bridge.call("device.set_parameter", {
      track_index: input.track_index,
      device_index: input.device_index,
      parameter_index: index,
      value: input.value,
    });
    const parsed = setParamBridgeResult.parse(raw);
    const v = verifyField(input.value, parsed.after, {
      tolerance: 1e-4,
      field: "value",
    });
    return {
      ok: true as const,
      verified: v.ok,
      ...parsed,
      resolved_from: resolvedFrom,
      diff: v.diff,
    };
  },
});
