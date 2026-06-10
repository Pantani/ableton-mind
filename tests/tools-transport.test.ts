/**
 * Tests for the Transport-domain MCP tools: play, stop, set_tempo.
 * Use a mocked BridgeClient — no real network.
 */

import { describe, expect, it, vi } from "vitest";

import { ABLETON_MIND_ERRORS, JsonRpcRemoteError } from "../src/live-client/index.js";
import type { BridgeClient } from "../src/server/context.js";
import { createToolContext } from "../src/server/context.js";
import { playTool, setTempoTool, stopTool } from "../src/tools/transport.js";

function bridge(call: BridgeClient["call"]): BridgeClient {
  return { call };
}

describe("playTool", () => {
  it("forwards from_beginning=false by default and shapes the response", async () => {
    const call = vi.fn(async (method: string, params: unknown) => {
      expect(method).toBe("transport.play");
      expect(params).toEqual({ from_beginning: false });
      return { changed: true, is_playing: true, current_song_time: 0 };
    });

    const ctx = createToolContext(bridge(call as BridgeClient["call"]));
    const result = await playTool.handler({}, ctx);

    expect(result).toMatchObject({
      ok: true,
      verified: true,
      changed: true,
      is_playing: true,
      current_song_time: 0,
    });
  });

  it("passes from_beginning=true when requested", async () => {
    const call = vi.fn(async (_m: string, params: unknown) => {
      expect(params).toEqual({ from_beginning: true });
      return { changed: true, is_playing: true, current_song_time: 0 };
    });
    const ctx = createToolContext(bridge(call as BridgeClient["call"]));
    await playTool.handler({ from_beginning: true }, ctx);
  });

  it("returns changed=false when bridge says idempotent", async () => {
    const call = vi.fn(async () => ({
      changed: false,
      is_playing: true,
      current_song_time: 12.5,
    }));
    const ctx = createToolContext(bridge(call as BridgeClient["call"]));
    const r = await playTool.handler({}, ctx);
    expect(r.changed).toBe(false);
    expect(r.current_song_time).toBe(12.5);
  });

  it("propagates JsonRpcRemoteError", async () => {
    const call = vi.fn(async () => {
      throw new JsonRpcRemoteError({
        code: ABLETON_MIND_ERRORS.LIVE_NOT_RUNNING,
        message: "Live song is not available",
      });
    });
    const ctx = createToolContext(bridge(call as BridgeClient["call"]));
    await expect(playTool.handler({}, ctx)).rejects.toMatchObject({
      name: "JsonRpcRemoteError",
      code: ABLETON_MIND_ERRORS.LIVE_NOT_RUNNING,
    });
  });
});

describe("stopTool", () => {
  it("calls transport.stop with empty params", async () => {
    const call = vi.fn(async (method: string, params: unknown) => {
      expect(method).toBe("transport.stop");
      expect(params).toEqual({});
      return { changed: true, is_playing: false, current_song_time: 8.0 };
    });
    const ctx = createToolContext(bridge(call as BridgeClient["call"]));
    const r = await stopTool.handler({}, ctx);
    expect(r.is_playing).toBe(false);
    expect(r.changed).toBe(true);
  });

  it("idempotent: changed=false if already stopped", async () => {
    const call = vi.fn(async () => ({
      changed: false,
      is_playing: false,
      current_song_time: 0,
    }));
    const ctx = createToolContext(bridge(call as BridgeClient["call"]));
    const r = await stopTool.handler({}, ctx);
    expect(r.changed).toBe(false);
  });
});

describe("setTempoTool", () => {
  it("forwards bpm and returns before/after", async () => {
    const call = vi.fn(async (method: string, params: unknown) => {
      expect(method).toBe("transport.set_tempo");
      expect(params).toEqual({ bpm: 140 });
      return { changed: true, before: 120, after: 140 };
    });
    const ctx = createToolContext(bridge(call as BridgeClient["call"]));
    const r = await setTempoTool.handler({ bpm: 140 }, ctx);
    expect(r).toMatchObject({ ok: true, verified: true, changed: true, before: 120, after: 140 });
  });

  it("input schema rejects out-of-range bpm", () => {
    expect(setTempoTool.input.safeParse({ bpm: 9999 }).success).toBe(false);
    expect(setTempoTool.input.safeParse({ bpm: 0 }).success).toBe(false);
    expect(setTempoTool.input.safeParse({ bpm: 128 }).success).toBe(true);
  });
});
