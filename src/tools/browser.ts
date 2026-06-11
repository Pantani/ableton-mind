/**
 * MCP tools for the Browser domain.
 *
 * `browser_get_categories` — lists the root categories of the Live Browser
 * (Audio Effects, MIDI Effects, Instruments, Drums, Samples, Sounds,
 * Current Project, User Library, Packs, Plug-ins).
 *
 * Phase 2 adds recursive walk + tag filters.
 */

import { z } from "zod";

import { defineTool } from "../server/define-tool.js";

const inputSchema = z.object({}).strict();

const categorySchema = z.object({
  key: z.string(),
  name: z.string(),
  is_folder: z.boolean(),
  is_loadable: z.boolean(),
});

const outputSchema = z.object({
  ok: z.literal(true),
  verified: z.literal(true),
  categories: z.array(categorySchema),
  available: z.boolean(),
  reason: z.string().optional(),
});

const bridgeResultSchema = z.object({
  categories: z.array(categorySchema),
  available: z.boolean(),
  reason: z.string().optional(),
});

export const browserGetCategoriesTool = defineTool({
  name: "browser_get_categories",
  description:
    "Read-only list of root categories exposed by the Ableton Live Browser. Use before loading instruments, effects, presets, or samples by browser path; returns available=false with a reason when browser access is unavailable or headless.",
  input: inputSchema,
  output: outputSchema,
  handler: async (_input, ctx) => {
    const raw = await ctx.bridge.call("browser.get_categories", {});
    const parsed = bridgeResultSchema.parse(raw);
    return { ok: true as const, verified: true as const, ...parsed };
  },
});

// ----- browser_load_item -----------------------------------------------------

const loadItemInputSchema = z.object({
  path: z
    .array(z.string().min(1))
    .min(1)
    .describe(
      'Browser path as an array of names. Ex: ["instruments", "Wavetable", "Pads", "Air Pad"].',
    ),
});

const loadItemOutputSchema = z.object({
  ok: z.literal(true),
  verified: z.literal(true),
  loaded: z.literal(true),
  name: z.string(),
  path: z.array(z.string()),
});

const loadItemBridgeResult = z.object({
  loaded: z.literal(true),
  name: z.string(),
  path: z.array(z.string()),
});

export const browserLoadItemTool = defineTool({
  name: "browser_load_item",
  description:
    "Load an Ableton Browser item such as an instrument, effect, preset, or sample onto the selected or armed track. Use after browser_get_categories/path discovery. NOT idempotent: repeated calls can add or replace devices/content; returns loaded item name and path.",
  input: loadItemInputSchema,
  output: loadItemOutputSchema,
  handler: async (input, ctx) => {
    const raw = await ctx.bridge.call("browser.load_item", { path: input.path });
    const parsed = loadItemBridgeResult.parse(raw);
    return { ok: true as const, verified: true as const, ...parsed };
  },
});
