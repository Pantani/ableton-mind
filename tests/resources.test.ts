/**
 * Tests do Resources subsystem (Cycle 19 — ADR-0011).
 */

import { describe, expect, it, vi } from "vitest";

import {
  allResources,
  knowledgeDevicesResource,
  loadResource,
  recipesIndexResource,
  sessionStateResource,
} from "../src/resources/index.js";
import type { BridgeClient } from "../src/server/context.js";
import { createToolContext } from "../src/server/context.js";
import { listResourcesTool } from "../src/tools/resources.js";

const SNAP = { ts: 100, tempo: 128, is_playing: false, total_tracks: 1, tracks: [] };

describe("resources registry", () => {
  it("exposes 3 unique resources", () => {
    expect(allResources).toHaveLength(3);
    const uris = allResources.map((r) => r.uri);
    expect(new Set(uris).size).toBe(uris.length);
    expect(uris).toContain("live://session/state");
    expect(uris).toContain("live://knowledge/devices");
    expect(uris).toContain("live://recipes/index");
  });

  it("loadResource returns null for unknown URI", () => {
    expect(loadResource("live://bogus")).toBeNull();
    expect(loadResource("live://session/state")).toBe(sessionStateResource);
  });

  it("every resource has mimeType application/json", () => {
    for (const r of allResources) {
      expect(r.mimeType).toBe("application/json");
    }
  });
});

describe("sessionStateResource", () => {
  it("returns bridge.snapshot result encoded as JSON text", async () => {
    const call = vi.fn(async (m: string) => {
      expect(m).toBe("session.snapshot");
      return SNAP;
    });
    const bridge: BridgeClient = { call };
    const r = await sessionStateResource.read(bridge);
    expect(r.contents).toHaveLength(1);
    expect(r.contents[0].uri).toBe("live://session/state");
    expect(r.contents[0].mimeType).toBe("application/json");
    const decoded = JSON.parse(r.contents[0].text);
    expect(decoded.tempo).toBe(128);
  });

  it("encodes bridge errors instead of throwing", async () => {
    const bridge: BridgeClient = {
      call: async () => {
        throw new Error("bridge offline");
      },
    };
    const r = await sessionStateResource.read(bridge);
    const decoded = JSON.parse(r.contents[0].text);
    expect(decoded.error).toMatch(/bridge offline/);
  });

  it("returns hint when bridge=null", async () => {
    const r = await sessionStateResource.read(null);
    const decoded = JSON.parse(r.contents[0].text);
    expect(decoded.error).toBe("bridge unavailable");
    expect(decoded.hint).toMatch(/Ableton Live/);
  });
});

describe("knowledgeDevicesResource", () => {
  it("lists all 55 devices with metadata", async () => {
    const r = await knowledgeDevicesResource.read(null);
    const decoded = JSON.parse(r.contents[0].text);
    expect(decoded.total).toBeGreaterThanOrEqual(55);
    expect(decoded.devices[0]).toHaveProperty("id");
    expect(decoded.devices[0]).toHaveProperty("category");
    expect(decoded.devices[0]).toHaveProperty("parameter_count");
    const wt = decoded.devices.find((d: { id: string }) => d.id === "ableton.wavetable");
    expect(wt.parameter_count).toBeGreaterThanOrEqual(60);
  });
});

describe("recipesIndexResource", () => {
  it("lists all recipes with step_count", async () => {
    const r = await recipesIndexResource.read(null);
    const decoded = JSON.parse(r.contents[0].text);
    expect(decoded.total).toBeGreaterThanOrEqual(14);
    expect(decoded.recipes[0]).toHaveProperty("step_count");
    expect(decoded.recipes[0]).toHaveProperty("input_count");
  });
});

describe("listResourcesTool", () => {
  it("returns 3 resources with metadata", async () => {
    const ctx = createToolContext({ call: async () => ({}) });
    const r = await listResourcesTool.handler({}, ctx);
    expect(r.total).toBe(3);
    expect(r.resources).toHaveLength(3);
    for (const res of r.resources) {
      expect(res.uri).toMatch(/^live:\/\//);
      expect(res.mimeType).toBe("application/json");
    }
  });
});
