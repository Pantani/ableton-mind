/**
 * Recipe loader (ADR-0007).
 *
 * Loads static JSONs embedded from `recipes/` at the project root.
 * Phase 5: 1 seed recipe (`drums/tech-house-kick`). Phase 6+ adds dozens
 * per category.
 *
 * The runner (`runner.ts`) substitutes placeholders and dispatches steps via the bridge.
 */

import { readFile, readdir } from "node:fs/promises";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";

import { z } from "zod";

// In dev (tsx) `import.meta.url` is src/recipes/index.ts → recipes/ at "../..".
// In the published bundle the file is dist/index.js and scripts/copy-assets.mjs
// places recipes next to it at dist/recipes/. Probe both so loader works in
// both modes without an env flag.
const HERE = dirname(fileURLToPath(import.meta.url));
const RECIPES_DIR = join(HERE, "..", "..", "recipes");
const RECIPES_DIR_DIST = join(HERE, "recipes");

// ----- Schema (ADR-0007) -----------------------------------------------------

const inputDefSchema = z.object({
  type: z.enum(["string", "int", "number", "bool"]),
  default: z.unknown(),
  min: z.number().optional(),
  max: z.number().optional(),
  description: z.string().optional(),
});

const stepSchema = z.object({
  op: z.string().describe("JSON-RPC method, e.g. 'track.upsert' or 'clip.add_notes'."),
  args: z.record(z.unknown()),
  let: z.string().optional().describe("Bind result to a variable for subsequent steps."),
});

export const recipeSchema = z.object({
  $schema: z.string().optional(),
  id: z.string(),
  name: z.string(),
  category: z.enum([
    "drums",
    "bass",
    "chords",
    "racks",
    "arrangements",
    "mixing",
    "live_performance",
  ]),
  version: z.string(),
  description: z.string().optional(),
  tags: z.array(z.string()).optional(),
  inputs: z.record(inputDefSchema).optional(),
  steps: z.array(stepSchema),
});

export type Recipe = z.infer<typeof recipeSchema>;
export type RecipeStep = z.infer<typeof stepSchema>;

// ----- Loader ----------------------------------------------------------------

import { stat } from "node:fs/promises";

let cachedRoot: string | null = null;
async function recipesRoot(): Promise<string> {
  if (cachedRoot) return cachedRoot;
  for (const candidate of [RECIPES_DIR, RECIPES_DIR_DIST]) {
    try {
      const s = await stat(candidate);
      if (s.isDirectory()) {
        cachedRoot = candidate;
        return candidate;
      }
    } catch {
      // not here, try the next candidate
    }
  }
  // Fall back to the dev path; readers will surface ENOENT clearly.
  cachedRoot = RECIPES_DIR;
  return RECIPES_DIR;
}

async function readJsonRecipe(relPath: string): Promise<Recipe> {
  const raw = await readFile(join(await recipesRoot(), relPath), "utf8");
  return recipeSchema.parse(JSON.parse(raw));
}

/** Recursively lists all .json files under `recipes/`. */
export async function listRecipes(): Promise<Recipe[]> {
  const all: Recipe[] = [];
  const root = await recipesRoot();
  async function walk(rel: string): Promise<void> {
    const entries = await readdir(join(root, rel), { withFileTypes: true }).catch(() => []);
    for (const e of entries) {
      const next = rel ? `${rel}/${e.name}` : e.name;
      if (e.isDirectory()) {
        await walk(next);
      } else if (e.isFile() && e.name.endsWith(".json")) {
        try {
          all.push(await readJsonRecipe(next));
        } catch {
          // invalid recipe — skip silently; loader doesn't blow up.
        }
      }
    }
  }
  await walk("");
  return all;
}

/** Loads 1 recipe by id (`drums/tech-house-kick`). */
export async function loadRecipe(id: string): Promise<Recipe> {
  return await readJsonRecipe(`${id}.json`);
}
