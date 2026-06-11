import { mkdirSync, mkdtempSync, symlinkSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";

import { describe, expect, it } from "vitest";

import { describeRemoteScriptInstall, versionMatchCheck } from "../src/cli/doctor-core.js";

describe("doctor remote script checks", () => {
  it("fails when the installed symlink points at another checkout", () => {
    const root = mkdtempSync(join(tmpdir(), "ableton-mind-doctor-"));
    const expected = join(root, "current", "live", "AbletonMind");
    const other = join(root, "other", "live", "AbletonMind");
    const target = join(root, "Remote Scripts", "AbletonMind");

    mkdirSync(join(root, "Remote Scripts"), { recursive: true });
    symlinkSync(other, target, "dir");

    const result = describeRemoteScriptInstall(target, expected);
    expect(result.ok).toBe(false);
    expect(result.detail).toContain("symlink");
    expect(result.detail).toContain(other);
    expect(result.hint).toContain("current checkout");
  });
});

describe("doctor bridge version checks", () => {
  it("fails when bridge version differs from package version", () => {
    const result = versionMatchCheck("0.1.1", "0.0.21");
    expect(result.ok).toBe(false);
    expect(result.detail).toBe("bridge=0.0.21 pkg=0.1.1");
  });

  it("passes when bridge version matches package version", () => {
    const result = versionMatchCheck("0.1.1", "0.1.1");
    expect(result.ok).toBe(true);
    expect(result.detail).toBe("bridge=0.1.1 pkg=0.1.1");
  });
});
