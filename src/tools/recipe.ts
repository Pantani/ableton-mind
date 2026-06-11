/**
 * MCP tools for recipes (Track C debuts in Cycle 9).
 *
 * `list_recipes` (read-only) — returns metadata for all embedded recipes.
 * `apply_recipe` — executes recipe by id, with optional overrides.
 */

import { z } from "zod";

import { listRecipes, loadRecipe } from "../recipes/index.js";
import { applyRecipe } from "../recipes/runner.js";
import { defineTool } from "../server/define-tool.js";

// ----- list_recipes ----------------------------------------------------------

const listInputSchema = z.object({
  category: z
    .enum(["drums", "bass", "chords", "racks", "arrangements", "mixing", "live_performance"])
    .optional(),
});

const recipeMetaSchema = z.object({
  id: z.string(),
  name: z.string(),
  category: z.string(),
  version: z.string(),
  description: z.string().optional(),
  tags: z.array(z.string()).optional(),
});

const listOutputSchema = z.object({
  ok: z.literal(true),
  verified: z.literal(true),
  recipes: z.array(recipeMetaSchema),
  total: z.number().int().nonnegative(),
});

export const listRecipesTool = defineTool({
  name: "list_recipes",
  description:
    "Read-only list of embedded music recipes, optionally filtered by category. Use before apply_recipe to choose a valid recipe id; returns recipe metadata, tags, version, category, and total count without touching Live.",
  input: listInputSchema,
  output: listOutputSchema,
  handler: async (input, _ctx) => {
    const all = await listRecipes();
    const filtered = input.category ? all.filter((r) => r.category === input.category) : all;
    return {
      ok: true as const,
      verified: true as const,
      recipes: filtered.map((r) => ({
        id: r.id,
        name: r.name,
        category: r.category,
        version: r.version,
        description: r.description,
        tags: r.tags,
      })),
      total: filtered.length,
    };
  },
});

// ----- apply_recipe ----------------------------------------------------------

const applyInputSchema = z.object({
  recipe_id: z.string().describe("ex: 'drums/tech-house-kick'."),
  overrides: z
    .record(z.unknown())
    .optional()
    .describe("Override of inputs declared in the recipe."),
});

const applyOutputSchema = z.object({
  ok: z.boolean(),
  verified: z.literal(true),
  applied: z.boolean(),
  recipe_id: z.string(),
  steps: z.number().int().nonnegative(),
  completed: z.number().int().nonnegative(),
  failed_at: z.number().int().nonnegative().optional(),
  error: z.string().optional(),
});

export const applyRecipeTool = defineTool({
  name: "apply_recipe",
  description:
    "Apply an embedded recipe by id with optional overrides. Use after list_recipes when the user asks for a genre pattern, rack, mix chain, or arrangement scaffold. NOT fully transactional in Phase 5; returns progress and failed_at/error if a step fails.",
  input: applyInputSchema,
  output: applyOutputSchema,
  handler: async (input, ctx) => {
    const recipe = await loadRecipe(input.recipe_id);
    const result = await applyRecipe(recipe, input.overrides ?? {}, ctx.bridge);
    return {
      ok: result.applied,
      verified: true as const,
      applied: result.applied,
      recipe_id: result.recipe_id,
      steps: result.steps,
      completed: result.completed,
      failed_at: result.failed_at,
      error: result.error,
    };
  },
});
