/**
 * Recipe runner (ADR-0007).
 *
 * Recebe um Recipe + inputs do LLM + BridgeClient, executa steps sequencialmente
 * substituindo placeholders.
 *
 * Placeholder syntax: `"{{name}}"` em strings substitui por valor exato.
 *   `"{{var.path.to.field}}"` faz dotted access em variáveis `let`-bound.
 *   Strings com placeholders inline (ex: `"prefix-{{x}}"`) também funcionam.
 *
 * Falha num step → para execução, retorna progresso parcial.
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
    // Substituição completa: string inteira é `{{x}}` → devolve o tipo original.
    const wholeMatch = value.match(/^\{\{([^}]+)\}\}$/);
    if (wholeMatch) {
      return dottedGet(bindings, wholeMatch[1].trim());
    }
    // Substituição inline: stringifica.
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
