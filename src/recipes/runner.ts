/**
 * Recipe runner (ADR-0007).
 *
 * Takes a Recipe + inputs from the LLM + BridgeClient, executes steps sequentially
 * substituting placeholders.
 *
 * Placeholder syntax: `"{{name}}"` in strings substitutes with the exact value.
 *   `"{{var.path.to.field}}"` does dotted access on `let`-bound variables.
 *   Strings with inline placeholders (e.g. `"prefix-{{x}}"`) also work.
 *
 * Failure in a step → stops execution, returns partial progress.
 */

import type { BridgeClient } from "../server/context.js";

import type { Recipe } from "./index.js";

export interface ApplyResult {
  applied: boolean;
  recipe_id: string;
  steps: number;
  completed: number;
  failed_at?: number;
  error?: string;
  bindings: Record<string, unknown>;
}

const PLACEHOLDER_RE = /\{\{([^}]+)\}\}/g;

function dottedGet(obj: unknown, path: string): unknown {
  const parts = path.split(".");
  let cur: unknown = obj;
  for (const p of parts) {
    if (cur && typeof cur === "object" && p in (cur as Record<string, unknown>)) {
      cur = (cur as Record<string, unknown>)[p];
    } else {
      return undefined;
    }
  }
  return cur;
}

function resolveValue(value: unknown, bindings: Record<string, unknown>): unknown {
  if (typeof value === "string") {
    // Whole-string substitution: full string is `{{x}}` → return the original type.
    const wholeMatch = value.match(/^\{\{([^}]+)\}\}$/);
    if (wholeMatch) {
      return dottedGet(bindings, (wholeMatch[1] ?? "").trim());
    }
    // Inline substitution: stringifies.
    return value.replace(PLACEHOLDER_RE, (_, expr) => {
      const v = dottedGet(bindings, String(expr).trim());
      return v === undefined ? "" : String(v);
    });
  }
  if (Array.isArray(value)) {
    return value.map((v) => resolveValue(v, bindings));
  }
  if (value && typeof value === "object") {
    const out: Record<string, unknown> = {};
    for (const [k, v] of Object.entries(value)) {
      out[k] = resolveValue(v, bindings);
    }
    return out;
  }
  return value;
}

function resolveInputs(
  recipe: Recipe,
  overrides: Record<string, unknown> = {},
): Record<string, unknown> {
  const out: Record<string, unknown> = {};
  for (const [k, def] of Object.entries(recipe.inputs ?? {})) {
    out[k] = k in overrides ? overrides[k] : def.default;
  }
  return out;
}

export async function applyRecipe(
  recipe: Recipe,
  overrides: Record<string, unknown>,
  bridge: BridgeClient,
): Promise<ApplyResult> {
  const bindings: Record<string, unknown> = resolveInputs(recipe, overrides);
  let completed = 0;
  for (let i = 0; i < recipe.steps.length; i++) {
    const step = recipe.steps[i];
    if (!step) continue;
    const resolvedArgs = resolveValue(step.args, bindings) as Record<string, unknown>;
    try {
      const result = await bridge.call(step.op, resolvedArgs);
      if (step.let) {
        bindings[step.let] = result;
      }
      completed += 1;
    } catch (err) {
      return {
        applied: false,
        recipe_id: recipe.id,
        steps: recipe.steps.length,
        completed,
        failed_at: i,
        error: `${(err as Error).name}: ${(err as Error).message}`,
        bindings,
      };
    }
  }
  return {
    applied: true,
    recipe_id: recipe.id,
    steps: recipe.steps.length,
    completed,
    bindings,
  };
}
