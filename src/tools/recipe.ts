/**
 * Tools MCP para recipes (Trilha C estreia em Cycle 9).
 *
 * `list_recipes` (read-only) — devolve metadata de todas as recipes embarcadas.
 * `apply_recipe` — executa recipe por id, com overrides opcionais.
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
    "List embedded recipes. Optionally filter by category (drums, bass, chords, racks, arrangements, mixing, live_performance).",
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
    .describe("Substituição de inputs declarados na recipe."),
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
    "Apply a recipe by id. Recipes encode genre/style patterns (drum kits, basslines, racks) as sequences of LOM operations. Use list_recipes first to see available ids. Returns progress if a step fails (no rollback in Phase 5).",
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
