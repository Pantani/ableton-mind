/**
 * Recipe loader (ADR-0007).
 *
 * Carrega JSONs estáticos embarcados de `recipes/` na raiz do projeto.
 * Phase 5: 1 recipe seed (`drums/tech-house-kick`). Phase 6+ adiciona dezenas
 * por categoria.
 *
 * O runner (`runner.ts`) substitui placeholders e dispatcha steps via bridge.
 */

import { readFile, readdir } from "node:fs/promises";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";

import { z } from "zod";

const REPO_ROOT = join(dirname(fileURLToPath(import.meta.url)), "..", "..");
const RECIPES_DIR = join(REPO_ROOT, "recipes");

// ----- Schema (ADR-0007) -----------------------------------------------------

const inputDefSchema = z.object({
  type: z.enum(["string", "int", "number", "bool"]),
  default: z.unknown(),
  min: z.number().optional(),
  max: z.number().optional(),
  description: z.string().optional(),
});

const stepSchema = z.object({
  op: z.string().describe("JSON-RPC method, e.g. 'track.upsert' ou 'clip.add_notes'."),
  args: z.record(z.unknown()),
  let: z.string().optional().describe("Bind result em variável para steps seguintes."),
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

async function readJsonRecipe(relPath: string): Promise<Recipe> {
  const raw = await readFile(join(RECIPES_DIR, relPath), "utf8");
  return recipeSchema.parse(JSON.parse(raw));
}

/** Lista recursivamente todos os .json em `recipes/`. */
export async function listRecipes(): Promise<Recipe[]> {
  const all: Recipe[] = [];
  async function walk(rel: string): Promise<void> {
    const entries = await readdir(join(RECIPES_DIR, rel), { withFileTypes: true }).catch(() => []);
    for (const e of entries) {
      const next = rel ? `${rel}/${e.name}` : e.name;
      if (e.isDirectory()) {
        await walk(next);
      } else if (e.isFile() && e.name.endsWith(".json")) {
        try {
          all.push(await readJsonRecipe(next));
        } catch {
          // recipe inválida — skip silenciosamente; loader não derruba.
        }
      }
    }
  }
  await walk("");
  return all;
}

/** Carrega 1 recipe por id (`drums/tech-house-kick`). */
export async function loadRecipe(id: string): Promise<Recipe> {
  return await readJsonRecipe(`${id}.json`);
}
