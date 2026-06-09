/**
 * TD-038 — validação de artefatos de distribuição (Phase 7).
 *
 * Não roda os workflows reais — apenas valida que YAMLs/JSONs estão parseáveis,
 * referencias internas existem, e CHANGELOG tem formato esperado.
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
    expect(ci).toContain("npm run test");
    expect(ci).toMatch(/python.*unittest/);
  });

  it("release.yml exists and references npm publish + docker", () => {
    expect(existsSync(join(REPO_ROOT, ".github/workflows/release.yml"))).toBe(true);
    const rel = read(".github/workflows/release.yml");
    expect(rel).toMatch(/^name:\s*Release/m);
    expect(rel).toContain("npm publish");
    expect(rel).toContain("ghcr.io");
    expect(rel).toContain("softprops/action-gh-release");
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
    // recipes/ é mantido (não está na ignore)
    expect(ig).not.toMatch(/^recipes\/$/m);
  });
});

describe("README + docs", () => {
  it("README.md (PT) e README.en.md (EN) ambos existem", () => {
    expect(existsSync(join(REPO_ROOT, "README.md"))).toBe(true);
    expect(existsSync(join(REPO_ROOT, "README.en.md"))).toBe(true);
  });

  it("docs/distribution.md cobre Docker Windows (TD-035) + secrets (TD-040)", () => {
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
