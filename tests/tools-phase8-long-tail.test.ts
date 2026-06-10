/**
 * Cycle 24 Phase 8 long-tail read-only tools.
 *
 * These tools only wrap bridge discovery calls. They do not mutate Live state.
 */

import { describe, expect, it, vi } from "vitest";

import type { BridgeClient } from "../src/server/context.js";
import { createToolContext } from "../src/server/context.js";
import {
  allTools,
  deviceInspectPatcherTool,
  deviceInspectPluginTool,
  sessionLinkStatusTool,
} from "../src/tools/index.js";

function bridge(call: BridgeClient["call"]): BridgeClient {
  return { call };
}

function deviceSummary(name: string, className: string, trackIndex = 0, deviceIndex = 0) {
  return {
    track_index: trackIndex,
    device_index: deviceIndex,
    name,
    class_name: className,
    class_display_name: name,
    type: null,
    is_active: null,
    is_enabled: null,
    can_have_chains: false,
    chain_count: 0,
  };
}

describe("deviceInspectPatcherTool", () => {
  it("calls device.inspect_patcher and returns M4L patcher metadata", async () => {
    const call = vi.fn(async (method: string, params: unknown) => {
      expect(method).toBe("device.inspect_patcher");
      expect(params).toEqual({ track_index: 1, device_index: 2 });
      return {
        available: true,
        read_only: true,
        is_max_for_live: true,
        reason: null,
        device: deviceSummary("LFO", "MxDeviceMidiEffect", 1, 2),
        patcher: {
          name: "LFO.amxd",
          path: "/Packs/Max for Live/Max MIDI Effect/LFO.amxd",
          identifier: "amxd-123",
          is_frozen: false,
          can_have_chains: false,
          chain_count: 0,
        },
        parameters: [
          {
            index: 0,
            name: "Rate",
            value: 0.25,
            min: 0,
            max: 1,
            is_quantized: false,
            value_items: [],
            automation_state: 0,
          },
        ],
        total_parameters: 1,
        unsupported_attributes: [],
      };
    });
    const ctx = createToolContext(bridge(call as BridgeClient["call"]));

    const result = await deviceInspectPatcherTool.handler({ track_index: 1, device_index: 2 }, ctx);

    expect(result).toMatchObject({
      ok: true,
      verified: true,
      read_only: true,
      available: true,
      is_max_for_live: true,
    });
    expect(result.device.track_index).toBe(1);
    expect(result.device.device_index).toBe(2);
    expect(result.device.class_name).toBe("MxDeviceMidiEffect");
    expect(result.patcher?.name).toBe("LFO.amxd");
    expect(result.patcher?.identifier).toBe("amxd-123");
    expect(result.parameters).toHaveLength(1);
    expect(result.total_parameters).toBe(1);
  });

  it("passes through unavailable non-M4L discovery", async () => {
    const call = vi.fn(async () => ({
      available: false,
      read_only: true,
      is_max_for_live: false,
      reason: "device does not expose Max for Live patcher metadata",
      device: deviceSummary("EQ Eight", "Eq8"),
      patcher: null,
      parameters: [],
      total_parameters: 0,
      unsupported_attributes: ["patcher_name"],
    }));
    const ctx = createToolContext(bridge(call as BridgeClient["call"]));

    const result = await deviceInspectPatcherTool.handler({ track_index: 0, device_index: 0 }, ctx);

    expect(result.available).toBe(false);
    expect(result.reason).toMatch(/Max for Live/);
    expect(result.patcher).toBeNull();
    expect(result.unsupported_attributes).toContain("patcher_name");
  });

  it("rejects negative input indexes", () => {
    expect(
      deviceInspectPatcherTool.input.safeParse({ track_index: -1, device_index: 0 }).success,
    ).toBe(false);
    expect(
      deviceInspectPatcherTool.input.safeParse({ track_index: 0, device_index: -1 }).success,
    ).toBe(false);
  });
});

describe("deviceInspectPluginTool", () => {
  it("calls device.inspect_plugin and returns plug-in metadata and parameters", async () => {
    const call = vi.fn(async (method: string, params: unknown) => {
      expect(method).toBe("device.inspect_plugin");
      expect(params).toEqual({ track_index: 3, device_index: 1 });
      return {
        available: true,
        read_only: true,
        is_plugin: true,
        reason: null,
        device: deviceSummary("Diva", "PluginDevice", 3, 1),
        plugin: {
          name: "Diva",
          format: "vst3",
          vendor: "u-he",
          version: "1.4.8",
          identifier: "com.u-he.diva.vst3",
          path: "/Library/Audio/Plug-Ins/VST3/Diva.vst3",
          preset_name: null,
          preset_index: null,
        },
        parameters: [
          {
            index: 4,
            name: "Cutoff",
            value: 0.72,
            min: 0,
            max: 1,
            is_quantized: false,
            value_items: [],
            automation_state: 0,
          },
        ],
        total_parameters: 1,
        unsupported_attributes: [],
      };
    });
    const ctx = createToolContext(bridge(call as BridgeClient["call"]));

    const result = await deviceInspectPluginTool.handler({ track_index: 3, device_index: 1 }, ctx);

    expect(result).toMatchObject({
      ok: true,
      verified: true,
      read_only: true,
      available: true,
      is_plugin: true,
      total_parameters: 1,
    });
    expect(result.device.track_index).toBe(3);
    expect(result.device.device_index).toBe(1);
    expect(result.plugin?.format).toBe("vst3");
    expect(result.plugin?.path).toBe("/Library/Audio/Plug-Ins/VST3/Diva.vst3");
    expect(result.parameters[0].name).toBe("Cutoff");
  });

  it("passes through unavailable non-plug-in discovery", async () => {
    const call = vi.fn(async () => ({
      available: false,
      read_only: true,
      is_plugin: false,
      reason: "device does not expose plug-in metadata",
      device: deviceSummary("Wavetable", "InstrumentVector"),
      plugin: null,
      parameters: [],
      total_parameters: 0,
      unsupported_attributes: ["plugin_format"],
    }));
    const ctx = createToolContext(bridge(call as BridgeClient["call"]));

    const result = await deviceInspectPluginTool.handler({ track_index: 0, device_index: 0 }, ctx);

    expect(result.available).toBe(false);
    expect(result.plugin).toBeNull();
    expect(result.total_parameters).toBe(0);
  });

  it("output schema rejects unknown plug-in formats", () => {
    expect(
      deviceInspectPluginTool.output.safeParse({
        ok: true,
        verified: true,
        available: true,
        read_only: true,
        is_plugin: true,
        reason: null,
        device: deviceSummary("Mystery", "PluginDevice"),
        plugin: {
          name: "Mystery",
          format: "vst4",
          vendor: null,
          version: null,
          identifier: null,
          path: null,
          preset_name: null,
          preset_index: null,
        },
        parameters: [],
        total_parameters: 0,
        unsupported_attributes: [],
      }).success,
    ).toBe(false);
  });
});

describe("sessionLinkStatusTool", () => {
  it("calls session.link_status with no params and returns Link status", async () => {
    const call = vi.fn(async (method: string, params: unknown) => {
      expect(method).toBe("session.link_status");
      expect(params).toEqual({});
      return {
        available: true,
        read_only: true,
        source: "song",
        enabled: true,
        is_connected: true,
        num_peers: 2,
        start_stop_sync_enabled: false,
        tempo_sync_enabled: true,
        quantum: 4,
        reason: null,
        unsupported_attributes: [],
      };
    });
    const ctx = createToolContext(bridge(call as BridgeClient["call"]));

    const result = await sessionLinkStatusTool.handler({}, ctx);

    expect(result).toMatchObject({
      ok: true,
      verified: true,
      read_only: true,
      available: true,
      enabled: true,
      is_connected: true,
      num_peers: 2,
    });
  });

  it("returns nullable status fields when Link is unavailable", async () => {
    const call = vi.fn(async () => ({
      available: false,
      read_only: true,
      source: "none",
      enabled: null,
      is_connected: null,
      num_peers: null,
      start_stop_sync_enabled: null,
      tempo_sync_enabled: null,
      quantum: null,
      reason: "Live song/application does not expose Ableton Link status attributes",
      unsupported_attributes: ["song.link_enabled"],
    }));
    const ctx = createToolContext(bridge(call as BridgeClient["call"]));

    const result = await sessionLinkStatusTool.handler({}, ctx);

    expect(result.available).toBe(false);
    expect(result.enabled).toBeNull();
    expect(result.is_connected).toBeNull();
    expect(result.reason).toMatch(/does not expose/);
  });
});

describe("Phase 8 long-tail tool registration", () => {
  it("registers the read-only long-tail tools", () => {
    const names = new Set(allTools.map((tool) => tool.name));
    expect(names.has("device_inspect_patcher")).toBe(true);
    expect(names.has("device_inspect_plugin")).toBe(true);
    expect(names.has("session_link_status")).toBe(true);
  });
});
