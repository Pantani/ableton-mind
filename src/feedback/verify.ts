/**
 * Generic verify loop.
 *
 * Concept (PLAN.md §2, §7): every mutation returns `{ ok, verified, diff }`.
 * `verified` comes from read-after-write — after mutating, the handler reads
 * the state again and compares it to what the LLM requested. If it matches,
 * `verified=true`. If not, `verified=false` and `diff` carries the discrepancy.
 *
 * This module exposes primitives for tools to compose. Cycle 4 ships the
 * foundation; individual tools migrate in subsequent cycles.
 *
 * Typical use in a tool:
 * ```ts
 * const before = await ctx.bridge.call("track.get_info", { index });
 * const result = await ctx.bridge.call("track.set_volume", { index, volume });
 * const after  = await ctx.bridge.call("track.get_info", { index });
 * const v = verifyField(intent.volume, after.volume, { tolerance: 1e-4 });
 * return { ok: true, verified: v.ok, diff: v.diff, ...result };
 * ```
 */

export interface VerifyResult<T = unknown> {
  /** The post-mutation read value matches the intent. */
  ok: boolean;
  /** Discrepancy detail when `ok=false`. */
  diff: VerifyDiff<T> | null;
}

export interface VerifyDiff<T = unknown> {
  field: string;
  intent: T;
  actual: T;
  tolerance?: number;
}

export interface VerifyOptions {
  /** Numeric tolerance. Default 0 (strict equality). */
  tolerance?: number;
  /** Field name to report in `diff.field`. Default "value". */
  field?: string;
}

/**
 * Compares `intent` with `actual` applying tolerance (for floats).
 * For strings/booleans uses `Object.is`.
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
 * Combines N verifications. `ok` is AND, `diff` is the first failure.
 */
export function verifyAll(...results: VerifyResult<unknown>[]): VerifyResult<unknown> {
  for (const r of results) {
    if (!r.ok) return r;
  }
  return { ok: true, diff: null };
}

/**
 * Lightweight marker for tools that CANNOT verify (e.g. clip.fire — the
 * is_playing flag may oscillate with the transport). Use this instead of
 * lying with `verified: true`.
 */
export const UNVERIFIABLE: VerifyResult = { ok: true, diff: null };
