/**
 * Cycle 7 + Cycle 8 tests (TD-022 + TD-023).
 *
 * Covers:
 *  - parseParameterLocator (all formats)
 *  - arrangementAddAutomationPointTool
 *  - clipSetEnvelopeTool (incl. curve_type=hold)
 *  - getServerNotifier adapter (TD-019)
 *  - Verify behavior in transport.play/stop and clip.fire/stop (UNVERIFIABLE)
 */

import { describe, expect, it, vi } from "vitest";

import { SdkIncompatibilityError, getServerNotifier } from "../src/server/_mcp-internals.js";
import type { BridgeClient } from "../src/server/context.js";
import { createToolContext } from "../src/server/context.js";
import { parseParameterLocator } from "../src/tools/_locator.js";
import { arrangementAddAutomationPointTool } from "../src/tools/arrangement.js";
import { clipFireTool, clipSetEnvelopeTool, clipStopTool } from "../src/tools/clip.js";
import { playTool, stopTool } from "../src/tools/transport.js";

function bridge(call: BridgeClient["call"]): BridgeClient {
  return { call };
}

// ----- parseParameterLocator -------------------------------------------------

describe("parseParameterLocator", () => {
  it("mixer.volume", () => {
    expect(parseParameterLocator("mixer.volume")).toEqual({ kind: "mixer_volume" });
  });

  it("mixer.panning", () => {
    expect(parseParameterLocator("mixer.panning")).toEqual({ kind: "mixer_panning" });
  });

  it("mixer.send.<i>", () => {
    expect(parseParameterLocator("mixer.send.3")).toEqual({
      kind: "mixer_send",
      send_index: 3,
    });
  });

  it("device.<i>.parameter.<n>", () => {
    expect(parseParameterLocator("device.0.parameter.5")).toEqual({
      kind: "device_param",
      device_index: 0,
      parameter_index: 5,
    });
  });

  it("trims whitespace", () => {
    expect(parseParameterLocator("  mixer.volume  ")).toEqual({ kind: "mixer_volume" });
  });

  it("throws on unknown path", () => {
    expect(() => parseParameterLocator("bogus.path")).toThrow(/unknown parameter_path/);
    expect(() => parseParameterLocator("mixer.send.")).toThrow();
    expect(() => parseParameterLocator("device.x.parameter.0")).toThrow();
  });
});

// ----- arrangementAddAutomationPointTool -------------------------------------

describe("arrangementAddAutomationPointTool", () => {
  it("forwards locator + time/value with default curve_type", async () => {
    const call = vi.fn(async (m: string, p: unknown) => {
      expect(m).toBe("arrangement.add_automation_point");
      expect(p).toEqual({
        track_index: 0,
        parameter_locator: { kind: "mixer_volume" },
        time: 4,
        value: 0.7,
        curve_type: "linear",
      });
      return {
        added: true,
        track_index: 0,
        time: 4,
        value: 0.7,
        curve_type: "linear",
      };
    });
    const ctx = createToolContext(bridge(call as BridgeClient["call"]));
    const r = await arrangementAddAutomationPointTool.handler(
      { track_index: 0, parameter_path: "mixer.volume", time: 4, value: 0.7 },
      ctx,
    );
    expect(r.added).toBe(true);
    expect(r.curve_type).toBe("linear");
  });

  it("passes through hold curve_type", async () => {
    const call = vi.fn(async (_m: string, p: unknown) => {
      expect((p as { curve_type: string }).curve_type).toBe("hold");
      return { added: true, track_index: 0, time: 4, value: 1, curve_type: "hold" };
    });
    const ctx = createToolContext(bridge(call as BridgeClient["call"]));
    await arrangementAddAutomationPointTool.handler(
      {
        track_index: 0,
        parameter_path: "device.0.parameter.5",
        time: 4,
        value: 1,
        curve_type: "hold",
      },
      ctx,
    );
  });
});

// ----- clipSetEnvelopeTool ---------------------------------------------------

describe("clipSetEnvelopeTool", () => {
  it("forwards points and matches count for linear", async () => {
    const call = vi.fn(async (_m: string, p: unknown) => {
      const params = p as { points: unknown[] };
      expect(params.points).toHaveLength(3);
      return {
        changed: true,
        replaced: true,
        points: 3,
        track_index: 0,
        clip_slot_index: 0,
      };
    });
    const ctx = createToolContext(bridge(call as BridgeClient["call"]));
    const r = await clipSetEnvelopeTool.handler(
      {
        track_index: 0,
        clip_slot_index: 0,
        parameter_path: "mixer.volume",
        points: [
          { time: 0, value: 0 },
          { time: 2, value: 0.5 },
          { time: 4, value: 1 },
        ],
      },
      ctx,
    );
    expect(r.verified).toBe(true);
    expect(r.points).toBe(3);
  });

  it("computes expected count with hold curve_type (2 points per hold after first)", async () => {
    // 3 input points; 2 are hold (indices 1 and 2). Expected = 1 + 2 + 2 = 5.
    const call = vi.fn(async () => ({
      changed: true,
      replaced: true,
      points: 5,
      track_index: 0,
      clip_slot_index: 0,
    }));
    const ctx = createToolContext(bridge(call as BridgeClient["call"]));
    const r = await clipSetEnvelopeTool.handler(
      {
        track_index: 0,
        clip_slot_index: 0,
        parameter_path: "mixer.volume",
        points: [
          { time: 0, value: 0 },
          { time: 2, value: 0.5, curve_type: "hold" },
          { time: 4, value: 1, curve_type: "hold" },
        ],
      },
      ctx,
    );
    expect(r.verified).toBe(true);
    expect(r.points).toBe(5);
  });

  it("verified=false when bridge reports unexpected count", async () => {
    const call = vi.fn(async () => ({
      changed: true,
      replaced: true,
      points: 99,
      track_index: 0,
      clip_slot_index: 0,
    }));
    const ctx = createToolContext(bridge(call as BridgeClient["call"]));
    const r = await clipSetEnvelopeTool.handler(
      {
        track_index: 0,
        clip_slot_index: 0,
        parameter_path: "mixer.volume",
        points: [{ time: 0, value: 0 }],
      },
      ctx,
    );
    expect(r.verified).toBe(false);
    expect(r.diff?.field).toBe("points");
  });
});

// ----- getServerNotifier adapter ---------------------------------------------

describe("getServerNotifier (TD-019)", () => {
  it("returns notifier when SDK exposes server.notification", async () => {
    const notification = vi.fn(async () => {});
    const fakeServer = { server: { notification } };
    const notifier = getServerNotifier(fakeServer as never);
    await notifier("event.test", { foo: 1 });
    expect(notification).toHaveBeenCalledWith({ method: "event.test", params: { foo: 1 } });
  });

  it("throws SdkIncompatibilityError when internals missing", () => {
    expect(() => getServerNotifier({} as never)).toThrow(SdkIncompatibilityError);
    expect(() => getServerNotifier({ server: {} } as never)).toThrow(SdkIncompatibilityError);
    expect(() => getServerNotifier({ server: { notification: "not-a-fn" } } as never)).toThrow();
  });
});

// ----- TD-016 finish: UNVERIFIABLE markers -----------------------------------

describe("transport tools — UNVERIFIABLE behavior (TD-016 finish)", () => {
  it("playTool: verified=true with no diff (UNVERIFIABLE sentinel)", async () => {
    const call = vi.fn(async () => ({
      changed: true,
      is_playing: true,
      current_song_time: 0,
    }));
    const ctx = createToolContext(bridge(call as BridgeClient["call"]));
    const r = await playTool.handler({}, ctx);
    expect(r.verified).toBe(true);
    expect(r.diff).toBeNull();
  });

  it("stopTool: verified=true with no diff (UNVERIFIABLE)", async () => {
    const call = vi.fn(async () => ({
      changed: true,
      is_playing: false,
      current_song_time: 5,
    }));
    const ctx = createToolContext(bridge(call as BridgeClient["call"]));
    const r = await stopTool.handler({}, ctx);
    expect(r.verified).toBe(true);
    expect(r.diff).toBeNull();
  });

  it("clipFireTool: UNVERIFIABLE", async () => {
    const call = vi.fn(async () => ({
      changed: true,
      is_playing: true,
      track_index: 0,
      clip_slot_index: 0,
    }));
    const ctx = createToolContext(bridge(call as BridgeClient["call"]));
    const r = await clipFireTool.handler({ track_index: 0, clip_slot_index: 0 }, ctx);
    expect(r.verified).toBe(true);
    expect(r.diff).toBeNull();
  });

  it("clipStopTool: UNVERIFIABLE", async () => {
    const call = vi.fn(async () => ({
      changed: true,
      is_playing: false,
      track_index: 0,
      clip_slot_index: 0,
    }));
    const ctx = createToolContext(bridge(call as BridgeClient["call"]));
    const r = await clipStopTool.handler({ track_index: 0, clip_slot_index: 0 }, ctx);
    expect(r.verified).toBe(true);
    expect(r.diff).toBeNull();
  });
});
