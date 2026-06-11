import { describe, expect, it } from "vitest";

import { resolveEntrypointAction } from "../src/cli/entrypoint.js";

describe("main CLI entrypoint routing", () => {
  it("shows help without starting the MCP server", () => {
    const action = resolveEntrypointAction(["--help"]);
    expect(action.kind).toBe("print");
    expect(action.exitCode).toBe(0);
    expect(action.stdout).toContain("Usage:");
    expect(action.startsServer).toBe(false);
  });

  it("prints package version without starting the MCP server", () => {
    const action = resolveEntrypointAction(["--version"]);
    expect(action.kind).toBe("print");
    expect(action.exitCode).toBe(0);
    expect(action.stdout.trim()).toMatch(/^\d+\.\d+\.\d+/);
    expect(action.startsServer).toBe(false);
  });

  it("rejects unknown subcommands before connecting to Live", () => {
    const action = resolveEntrypointAction(["bogus"]);
    expect(action.kind).toBe("print");
    expect(action.exitCode).toBe(1);
    expect(action.stderr).toContain("Unknown command: bogus");
    expect(action.startsServer).toBe(false);
  });

  it("starts server only when no CLI subcommand is provided", () => {
    const action = resolveEntrypointAction([]);
    expect(action.kind).toBe("server");
    expect(action.startsServer).toBe(true);
  });
});
