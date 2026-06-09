/**
 * Verify loop genérico.
 *
 * Conceito (PLAN.md §2, §7): toda mutação devolve `{ ok, verified, diff }`.
 * O `verified` vem do read-after-write — depois de mutar, o handler lê o
 * estado novamente e compara com o que o LLM pediu. Se bate, `verified=true`.
 * Se não, `verified=false` e `diff` carrega a discrepância.
 *
 * Este módulo expõe primitivos para os tools comporem isso. Cycle 4 entrega
 * a foundation; tools individuais vão sendo migradas em Cycles seguintes.
 *
 * Uso típico num tool:
 * ```ts
 * const before = await ctx.bridge.call("track.get_info", { index });
 * const result = await ctx.bridge.call("track.set_volume", { index, volume });
 * const after  = await ctx.bridge.call("track.get_info", { index });
 * const v = verifyField(intent.volume, after.volume, { tolerance: 1e-4 });
 * return { ok: true, verified: v.ok, diff: v.diff, ...result };
 * ```
 */

export interface VerifyResult<T = unknown> {
  /** O valor lido pós-mutação bate com o intent. */
  ok: boolean;
  /** Detalhe da discrepância quando `ok=false`. */
  diff: VerifyDiff<T> | null;
}

export interface VerifyDiff<T = unknown> {
  field: string;
  intent: T;
  actual: T;
  tolerance?: number;
}

export interface VerifyOptions {
  /** Tolerância numérica. Default 0 (igualdade estrita). */
  tolerance?: number;
  /** Nome do campo para reportar em `diff.field`. Default "value". */
  field?: string;
}

/**
 * Compara `intent` com `actual` aplicando tolerância (para floats).
 * Para strings/booleans usa `Object.is`.
 */
export function verifyField<T>(intent: T, actual: T, opts: VerifyOptions = {}): VerifyResult<T> {
  const field = opts.field ?? "value";
  const tol = opts.tolerance ?? 0;

  if (typeof intent === "number" && typeof actual === "number") {
    const diff = Math.abs(intent - actual);
    if (diff <= tol) return { ok: true, diff: null };
    return {
      ok: false,
      diff: { field, intent, actual, tolerance: tol },
    };
  }

  if (Object.is(intent, actual)) {
    return { ok: true, diff: null };
  }
  return { ok: false, diff: { field, intent, actual } };
}

/**
 * Combina N verificações. `ok` é AND, `diff` é o primeiro falho.
 */
export function verifyAll(...results: VerifyResult<unknown>[]): VerifyResult<unknown> {
  for (const r of results) {
    if (!r.ok) return r;
  }
  return { ok: true, diff: null };
}

/**
 * Marker leve para tools que NÃO conseguem verificar (ex: clip.fire — o
 * is_playing pode oscilar conforme o transport). Usar em vez de mentir com
 * `verified: true`.
 */
export const UNVERIFIABLE: VerifyResult = { ok: true, diff: null };
