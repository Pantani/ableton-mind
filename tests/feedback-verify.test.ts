/**
 * Tests for the generic verify loop.
 */

import { describe, expect, it } from "vitest";

import { UNVERIFIABLE, verifyAll, verifyField } from "../src/feedback/verify.js";

describe("verifyField", () => {
  it("numbers: equal within tolerance", () => {
    const r = verifyField(120.0, 120.0001, { tolerance: 1e-3, field: "tempo" });
    expect(r.ok).toBe(true);
    expect(r.diff).toBeNull();
  });

  it("numbers: outside tolerance", () => {
    const r = verifyField(120.0, 121.0, { tolerance: 1e-3, field: "tempo" });
    expect(r.ok).toBe(false);
    expect(r.diff).toEqual({
      field: "tempo",
      intent: 120.0,
      actual: 121.0,
      tolerance: 1e-3,
    });
  });

  it("strings: equal", () => {
    const r = verifyField("Bass", "Bass", { field: "name" });
    expect(r.ok).toBe(true);
  });

  it("strings: different", () => {
    const r = verifyField("Bass", "Lead", { field: "name" });
    expect(r.ok).toBe(false);
    expect(r.diff?.actual).toBe("Lead");
  });

  it("booleans: equal", () => {
    expect(verifyField(true, true).ok).toBe(true);
    expect(verifyField(false, false).ok).toBe(true);
  });

  it("default field name is 'value'", () => {
    const r = verifyField(1, 2);
    expect(r.diff?.field).toBe("value");
  });
});

describe("verifyAll", () => {
  it("AND of multiple verifies; returns first failure", () => {
    const r = verifyAll(
      verifyField(1, 1, { field: "a" }),
      verifyField(2, 3, { field: "b" }),
      verifyField(4, 4, { field: "c" }),
    );
    expect(r.ok).toBe(false);
    expect(r.diff?.field).toBe("b");
  });

  it("all pass → ok=true", () => {
    const r = verifyAll(verifyField(1, 1, { field: "a" }), verifyField("x", "x", { field: "b" }));
    expect(r.ok).toBe(true);
  });

  it("empty → ok=true", () => {
    expect(verifyAll().ok).toBe(true);
  });
});

describe("UNVERIFIABLE", () => {
  it("is always passing", () => {
    expect(UNVERIFIABLE.ok).toBe(true);
    expect(UNVERIFIABLE.diff).toBeNull();
  });
});
