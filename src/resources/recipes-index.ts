import { listRecipes } from "../recipes/index.js";

import type { ResourceDefinition } from "./index.js";

/**
 * `live://recipes/index` — índice de todas as 14 recipes embarcadas.
 * Lê dos JSONs em `recipes/`, não toca bridge.
 */
export const recipesIndexResource: ResourceDefinition = {
  uri: "live://recipes/index",
  name: "recipes_index",
  description: "Index of all embedded recipes (id, name, category, version, tags).",
  mimeType: "application/json",
  read: async () => {
    try {
      const recipes = await listRecipes();
      const index = recipes.map((r) => ({
        id: r.id,
        name: r.name,
        category: r.category,
        version: r.version,
        description: r.description,
        tags: r.tags ?? [],
        step_count: r.steps.length,
        input_count: Object.keys(r.inputs ?? {}).length,
      }));
      return {
        contents: [
          {
            uri: "live://recipes/index",
            mimeType: "application/json",
            text: JSON.stringify({ total: index.length, recipes: index }, null, 2),
          },
        ],
      };
    } catch (err) {
      return {
        contents: [
          {
            uri: "live://recipes/index",
            mimeType: "application/json",
            text: JSON.stringify(
              { error: (err as Error).message, name: (err as Error).name },
              null,
              2,
            ),
          },
        ],
      };
    }
  },
};
