/**
 * TD-038 — validation of distribution artifacts (Phase 7).
 *
 * Doesn't run the real workflows — just validates that YAMLs/JSONs are parseable,
 * internal references exist, and CHANGELOG has the expected format.
 */

import { existsSync, readFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";

import { describe, expect, it } from "vitest";

const REPO_ROOT = join(dirname(fileURLToPath(import.meta.url)), "..");

function read(rel: string): string {
  return readFileSync(join(REPO_ROOT, rel), "utf8");
}

describe("package.json + dxt/manifest.json version sync (ADR-0009)", () => {
  it("package.json::version === dxt/manifest.json::version", () => {
    const pkg = JSON.parse(read("package.json")) as { version: string };
    const dxt = JSON.parse(read("dxt/manifest.json")) as { version: string };
    expect(pkg.version).toBe(dxt.version);
  });

  it("version follows SemVer", () => {
    const pkg = JSON.parse(read("package.json")) as { version: string };
    expect(pkg.version).toMatch(/^\d+\.\d+\.\d+(-[0-9A-Za-z.-]+)?$/);
  });
});

describe("CHANGELOG.md", () => {
  it("exists and starts with `# Changelog`", () => {
    expect(existsSync(join(REPO_ROOT, "CHANGELOG.md"))).toBe(true);
    const ch = read("CHANGELOG.md");
    expect(ch.split("\n")[0]).toMatch(/^# Changelog/i);
  });

  it("has Unreleased section", () => {
    const ch = read("CHANGELOG.md");
    expect(ch).toMatch(/##\s*\[Unreleased\]/);
  });

  it("mentions current package.json version", () => {
    const pkg = JSON.parse(read("package.json")) as { version: string };
    const ch = read("CHANGELOG.md");
    expect(ch).toMatch(new RegExp(`##\\s*\\[${pkg.version.replace(/\./g, "\\.")}\\]`));
  });
});

describe(".github/workflows/*.yml — parseability + required keys", () => {
  it("ci.yml exists and references npm + python steps", () => {
    expect(existsSync(join(REPO_ROOT, ".github/workflows/ci.yml"))).toBe(true);
    const ci = read(".github/workflows/ci.yml");
    expect(ci).toMatch(/^name:\s*CI/m);
    expect(ci).toContain("npm run typecheck");
    // After porting tdmcp's workflow shape, `test` runs as `npm test` (no `run`).
    expect(ci).toMatch(/npm\s+(run\s+)?test/);
    expect(ci).toMatch(/python.*unittest/);
  });

  it("release.yml exists and references npm publish + docker", () => {
    expect(existsSync(join(REPO_ROOT, ".github/workflows/release.yml"))).toBe(true);
    const rel = read(".github/workflows/release.yml");
    expect(rel).toMatch(/^name:\s*Release/m);
    expect(rel).toContain("npm publish");
    expect(rel).toContain("ghcr.io");
    // After porting tdmcp's workflow shape, the release is created with the
    // `gh release create` CLI instead of the softprops/action-gh-release action.
    expect(rel).toMatch(/gh release (create|upload)/);
  });

  it("release.yml requires expected permissions for OIDC + release", () => {
    const rel = read(".github/workflows/release.yml");
    expect(rel).toMatch(/contents:\s*write/);
    expect(rel).toMatch(/packages:\s*write/);
    expect(rel).toMatch(/id-token:\s*write/);
  });
});

describe("Dockerfile + smithery.yaml + .npmignore", () => {
  it("Dockerfile multi-stage Node 20", () => {
    expect(existsSync(join(REPO_ROOT, "Dockerfile"))).toBe(true);
    const df = read("Dockerfile");
    expect(df).toMatch(/FROM node:20-alpine\s+AS builder/);
    expect(df).toMatch(/CMD\s*\[.*dist\/index\.js.*\]/);
  });

  it("smithery.yaml has commandFunction + configSchema", () => {
    expect(existsSync(join(REPO_ROOT, "smithery.yaml"))).toBe(true);
    const sm = read("smithery.yaml");
    expect(sm).toContain("commandFunction");
    expect(sm).toContain("configSchema");
    expect(sm).toContain("ABLETON_MIND_HOST");
  });

  it(".npmignore excludes src/ live/ tests/ but allows dist/recipes", () => {
    expect(existsSync(join(REPO_ROOT, ".npmignore"))).toBe(true);
    const ig = read(".npmignore");
    expect(ig).toMatch(/^src\/$/m);
    expect(ig).toMatch(/^live\/$/m);
    expect(ig).toMatch(/^tests\/$/m);
    // recipes/ is kept (not in the ignore list)
    expect(ig).not.toMatch(/^recipes\/$/m);
  });
});

describe("README + docs", () => {
  it("keeps English README at root and localized docs under docs/pt", () => {
    expect(existsSync(join(REPO_ROOT, "README.md"))).toBe(true);
    expect(existsSync(join(REPO_ROOT, "README" + ".en.md"))).toBe(false);
    expect(existsSync(join(REPO_ROOT, "docs/pt/index.md"))).toBe(true);
  });

  it("docs/distribution.md covers Docker Windows (TD-035) + secrets (TD-040)", () => {
    const dd = read("docs/distribution.md");
    expect(dd).toContain("WSL2");
    expect(dd).toContain("host.docker.internal");
    expect(dd).toContain("NPM_TOKEN");
    expect(dd).toContain("ghcr.io");
  });

  it("docs/smoke-test.md (TD-004 procedure) existe", () => {
    expect(existsSync(join(REPO_ROOT, "docs/smoke-test.md"))).toBe(true);
  });
});
