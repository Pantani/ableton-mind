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

const jsonScalarSchema = z.union([z.string(), z.number(), z.boolean(), z.null()]);

const deviceDiscoveryInputSchema = z
  .object({
    track_index: z.number().int().nonnegative(),
    device_index: z.number().int().nonnegative(),
  })
  .strict();

const deviceDiscoverySummarySchema = z.object({
  track_index: z.number().int().nonnegative(),
  device_index: z.number().int().nonnegative(),
  name: z.string(),
  class_name: z.string(),
  class_display_name: z.string(),
  type: jsonScalarSchema,
  is_active: z.boolean().nullable(),
  is_enabled: z.boolean().nullable(),
  can_have_chains: z.boolean().nullable(),
  chain_count: z.number().int().nonnegative(),
});

const patcherDescriptorSchema = z.object({
  name: z.string().nullable(),
  path: z.string().nullable(),
  identifier: z.string().nullable(),
  is_frozen: z.boolean().nullable(),
  can_have_chains: z.boolean().nullable(),
  chain_count: z.number().int().nonnegative(),
});

const pluginFormatSchema = z.enum(["vst", "vst3", "au", "unknown"]).nullable();

const pluginDescriptorSchema = z.object({
  name: z.string(),
  format: pluginFormatSchema,
  vendor: z.string().nullable(),
  version: z.string().nullable(),
  identifier: z.string().nullable(),
  path: z.string().nullable(),
  preset_name: z.string().nullable(),
  preset_index: z.number().int().nullable(),
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
    "Read-only list of parameters for a device by track/device index. Use before parameter automation or value changes; returns value/range/automation state and knowledge-base unit/description metadata when the device matches bundled schemas.",
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
    "Set one device parameter by parameter_index or parameter_name. Use after device_get_parameters when possible. Idempotent within 1e-4 (or exact for quantized values); name lookup adds one bridge call and returns before/after value with verification diff.",
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

// ----- device_inspect_patcher ------------------------------------------------

const inspectPatcherBridgeResult = z.object({
  available: z.boolean(),
  read_only: z.literal(true),
  is_max_for_live: z.boolean(),
  reason: z.string().nullable(),
  device: deviceDiscoverySummarySchema,
  patcher: patcherDescriptorSchema.nullable(),
  parameters: z.array(deviceParamSnapshotSchema),
  total_parameters: z.number().int().nonnegative(),
  unsupported_attributes: z.array(z.string()),
});

const inspectPatcherOutputSchema = inspectPatcherBridgeResult.extend({
  ok: z.literal(true),
  verified: z.literal(true),
});

export const deviceInspectPatcherTool = defineTool({
  name: "device_inspect_patcher",
  description:
    "Read-only Max for Live patcher discovery for a device. Use when deciding whether a device exposes inspectable M4L patcher metadata. Returns available=false with a reason when the target is not inspectable or the runtime lacks patcher access.",
  input: deviceDiscoveryInputSchema,
  output: inspectPatcherOutputSchema,
  handler: async (input, ctx) => {
    const raw = await ctx.bridge.call("device.inspect_patcher", input);
    const parsed = inspectPatcherBridgeResult.parse(raw);
    return inspectPatcherOutputSchema.parse({
      ok: true as const,
      verified: true as const,
      ...parsed,
    });
  },
});

// ----- device_inspect_plugin -------------------------------------------------

const inspectPluginBridgeResult = z.object({
  available: z.boolean(),
  read_only: z.literal(true),
  is_plugin: z.boolean(),
  reason: z.string().nullable(),
  device: deviceDiscoverySummarySchema,
  plugin: pluginDescriptorSchema.nullable(),
  parameters: z.array(deviceParamSnapshotSchema),
  total_parameters: z.number().int().nonnegative(),
  unsupported_attributes: z.array(z.string()),
});

const inspectPluginOutputSchema = inspectPluginBridgeResult.extend({
  ok: z.literal(true),
  verified: z.literal(true),
});

export const deviceInspectPluginTool = defineTool({
  name: "device_inspect_plugin",
  description:
    "Read-only VST/AU plug-in discovery for a device. Use when identifying third-party plug-ins without relying on user-edited device names. Returns plug-in identity and parameters, or available=false with a reason for native devices or unsupported runtimes.",
  input: deviceDiscoveryInputSchema,
  output: inspectPluginOutputSchema,
  handler: async (input, ctx) => {
    const raw = await ctx.bridge.call("device.inspect_plugin", input);
    const parsed = inspectPluginBridgeResult.parse(raw);
    return inspectPluginOutputSchema.parse({
      ok: true as const,
      verified: true as const,
      ...parsed,
    });
  },
});
