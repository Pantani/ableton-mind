/**
 * Tests for Cycle 5 tools missing in TD-018:
 *  - browserLoadItemTool
 *  - deviceGetParametersTool (knowledge enrichment)
 *  - deviceSetParameterTool (parameter_index and parameter_name)
 */

import { describe, expect, it, vi } from "vitest";

import type { BridgeClient } from "../src/server/context.js";
import { createToolContext } from "../src/server/context.js";
import {
  browserLoadItemTool,
  deviceGetParametersTool,
  deviceSetParameterTool,
} from "../src/tools/index.js";

function bridge(call: BridgeClient["call"]): BridgeClient {
  return { call };
}

describe("browserLoadItemTool", () => {
  it("forwards path and returns loaded=true", async () => {
    const call = vi.fn(async (m: string, p: unknown) => {
      expect(m).toBe("browser.load_item");
      expect(p).toEqual({ path: ["instruments", "Wavetable", "Pads", "Air Pad"] });
      return { loaded: true, name: "Air Pad", path: p.path };
    });
    const ctx = createToolContext(bridge(call as BridgeClient["call"]));
    const r = await browserLoadItemTool.handler(
      { path: ["instruments", "Wavetable", "Pads", "Air Pad"] },
      ctx,
    );
    expect(r.name).toBe("Air Pad");
    expect(r.loaded).toBe(true);
  });

  it("input schema rejects empty path", () => {
    expect(browserLoadItemTool.input.safeParse({ path: [] }).success).toBe(false);
    expect(browserLoadItemTool.input.safeParse({ path: ["a"] }).success).toBe(true);
  });
});

describe("deviceGetParametersTool", () => {
  it("enriches with knowledge when device matches", async () => {
    // Wavetable is in knowledge; the bridge returns "Wavetable" with 1 param.
    const call = vi.fn(async () => ({
      device_name: "Wavetable",
      class_name: "InstrumentVector",
      parameters: [
        {
          index: 0,
          name: "Osc 1 Position",
          value: 0,
          min: 0,
          max: 100,
          is_quantized: false,
          value_items: [],
          automation_state: 0,
        },
      ],
      total: 1,
    }));
    const ctx = createToolContext(bridge(call as BridgeClient["call"]));
    const r = await deviceGetParametersTool.handler({ track_index: 0, device_index: 0 }, ctx);
    expect(r.knowledge_matched).toBe(true);
    expect(r.parameters[0].knowledge?.unit).toBe("%");
    expect(r.parameters[0].knowledge?.modulatable).toBe(true);
  });

  it("returns knowledge=null when device not in base", async () => {
    const call = vi.fn(async () => ({
      device_name: "MysteryVST",
      class_name: "Plugin",
      parameters: [
        {
          index: 0,
          name: "P0",
          value: 0.5,
          min: 0,
          max: 1,
          is_quantized: false,
          value_items: [],
          automation_state: 0,
        },
      ],
      total: 1,
    }));
    const ctx = createToolContext(bridge(call as BridgeClient["call"]));
    const r = await deviceGetParametersTool.handler({ track_index: 0, device_index: 0 }, ctx);
    expect(r.knowledge_matched).toBe(false);
    expect(r.parameters[0].knowledge).toBeNull();
  });
});

describe("deviceSetParameterTool", () => {
  it("uses parameter_index directly when provided", async () => {
    const call = vi.fn(async (m: string, p: unknown) => {
      expect(m).toBe("device.set_parameter");
      expect(p).toEqual({
        track_index: 0,
        device_index: 0,
        parameter_index: 5,
        value: 0.5,
      });
      return { changed: true, name: "Osc 2 Position", before: 0, after: 0.5 };
    });
    const ctx = createToolContext(bridge(call as BridgeClient["call"]));
    const r = await deviceSetParameterTool.handler(
      { track_index: 0, device_index: 0, parameter_index: 5, value: 0.5 },
      ctx,
    );
    expect(r.changed).toBe(true);
    expect(r.resolved_from).toBe("index");
  });

  it("resolves parameter_name via 1 extra get_parameters call", async () => {
    const call = vi.fn(async (method: string, _params: unknown) => {
      if (method === "device.get_parameters") {
        return {
          device_name: "EQ Eight",
          class_name: "Eq8",
          parameters: [
            {
              index: 0,
              name: "Output Gain",
              value: 0,
              min: -24,
              max: 24,
              is_quantized: false,
              value_items: [],
              automation_state: 0,
            },
            {
              index: 1,
              name: "Frequency",
              value: 100,
              min: 30,
              max: 22000,
              is_quantized: false,
              value_items: [],
              automation_state: 0,
            },
          ],
          total: 2,
        };
      }
      // device.set_parameter
      return { changed: true, name: "Frequency", before: 100, after: 250 };
    });
    const ctx = createToolContext(bridge(call as BridgeClient["call"]));
    const r = await deviceSetParameterTool.handler(
      { track_index: 0, device_index: 0, parameter_name: "Frequency", value: 250 },
      ctx,
    );
    expect(r.resolved_from).toBe("name_via_bridge");
    expect(r.name).toBe("Frequency");
    expect(call).toHaveBeenCalledTimes(2);
  });

  it("rejects when neither index nor name is provided", () => {
    expect(
      deviceSetParameterTool.input.safeParse({
        track_index: 0,
        device_index: 0,
        value: 1,
      }).success,
    ).toBe(false);
  });

  it("throws when parameter_name is not found in device params", async () => {
    const call = vi.fn(async () => ({
      device_name: "EQ Eight",
      class_name: "Eq8",
      parameters: [
        {
          index: 0,
          name: "Output Gain",
          value: 0,
          min: -24,
          max: 24,
          is_quantized: false,
          value_items: [],
          automation_state: 0,
        },
      ],
      total: 1,
    }));
    const ctx = createToolContext(bridge(call as BridgeClient["call"]));
    await expect(
      deviceSetParameterTool.handler(
        { track_index: 0, device_index: 0, parameter_name: "BogusParam", value: 1 },
        ctx,
      ),
    ).rejects.toThrow(/not found/);
  });
});
