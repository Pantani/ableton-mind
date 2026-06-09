/**
 * Tools MCP do domínio Browser.
 *
 * `browser_get_categories` — lista as categorias raiz do Live Browser
 * (Audio Effects, MIDI Effects, Instruments, Drums, Samples, Sounds,
 * Current Project, User Library, Packs, Plug-ins).
 *
 * Phase 2 adiciona walk recursivo + filtros por tag.
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
    "List the root categories of the Ableton Live Browser. Returns available=false if browser is unavailable (headless).",
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
      'Browser path como array de nomes. Ex: ["instruments", "Wavetable", "Pads", "Air Pad"].',
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
    "Load a browser item (instrument / effect / preset / sample) onto the selected or armed track. Path is an array of names starting with a root category key (instruments, audio_effects, …).",
  input: loadItemInputSchema,
  output: loadItemOutputSchema,
  handler: async (input, ctx) => {
    const raw = await ctx.bridge.call("browser.load_item", { path: input.path });
    const parsed = loadItemBridgeResult.parse(raw);
    return { ok: true as const, verified: true as const, ...parsed };
  },
});
