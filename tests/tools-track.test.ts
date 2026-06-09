/**
 * Testes das tools track_list e track_create.
 */

import { describe, expect, it, vi } from "vitest";

import type { BridgeClient } from "../src/server/context.js";
import { createToolContext } from "../src/server/context.js";
import { trackCreateTool, trackListTool } from "../src/tools/track.js";

function bridge(call: BridgeClient["call"]): BridgeClient {
  return { call };
}

const SAMPLE_LIST_RESULT = {
  tracks: [
    {
      index: 0,
      name: "Drums",
      color_index: 14,
      is_midi: true,
      is_audio: false,
      is_grouped: false,
      is_foldable: false,
      mute: false,
      solo: false,
      arm: false,
    },
    {
      index: 1,
      name: "Vocals",
      color_index: 7,
      is_midi: false,
      is_audio: true,
      is_grouped: false,
      is_foldable: false,
      mute: false,
      solo: false,
      arm: true,
    },
  ],
  return_tracks: [{ index: 0, name: "Reverb", color_index: 3, mute: false, solo: false }],
  master_track: { name: "Master", color_index: 0 },
  total: 4,
};

describe("trackListTool", () => {
  it("defaults include_master=true include_returns=true", async () => {
    const call = vi.fn(async (method: string, params: unknown) => {
      expect(method).toBe("track.list");
      expect(params).toEqual({ include_master: true, include_returns: true });
      return SAMPLE_LIST_RESULT;
    });
    const ctx = createToolContext(bridge(call as BridgeClient["call"]));
    const r = await trackListTool.handler({}, ctx);
    expect(r.total).toBe(4);
    expect(r.tracks).toHaveLength(2);
    expect(r.return_tracks).toHaveLength(1);
    expect(r.master_track?.name).toBe("Master");
  });

  it("respects explicit excludes", async () => {
    const call = vi.fn(async (_m: string, params: unknown) => {
      expect(params).toEqual({ include_master: false, include_returns: false });
      return { ...SAMPLE_LIST_RESULT, return_tracks: [], master_track: null, total: 2 };
    });
    const ctx = createToolContext(bridge(call as BridgeClient["call"]));
    const r = await trackListTool.handler({ include_master: false, include_returns: false }, ctx);
    expect(r.master_track).toBeNull();
    expect(r.return_tracks).toEqual([]);
  });
});

describe("trackCreateTool", () => {
  it("creates a MIDI track at the end by default", async () => {
    const call = vi.fn(async (method: string, params: unknown) => {
      expect(method).toBe("track.create");
      expect(params).toEqual({ type: "midi", index: undefined, name: undefined });
      return {
        changed: true,
        track: { index: 3, name: "3 MIDI", is_midi: true, is_audio: false },
      };
    });
    const ctx = createToolContext(bridge(call as BridgeClient["call"]));
    const r = await trackCreateTool.handler({ type: "midi" }, ctx);
    expect(r.changed).toBe(true);
    expect(r.track.is_midi).toBe(true);
    expect(r.track.index).toBe(3);
  });

  it("forwards index and name", async () => {
    const call = vi.fn(async (_m: string, params: unknown) => {
      expect(params).toEqual({ type: "audio", index: 1, name: "Lead Vox" });
      return {
        changed: true,
        track: { index: 1, name: "Lead Vox", is_midi: false, is_audio: true },
      };
    });
    const ctx = createToolContext(bridge(call as BridgeClient["call"]));
    const r = await trackCreateTool.handler({ type: "audio", index: 1, name: "Lead Vox" }, ctx);
    expect(r.track.name).toBe("Lead Vox");
  });

  it("input schema rejects bad type", () => {
    expect(trackCreateTool.input.safeParse({ type: "group" }).success).toBe(false);
    expect(trackCreateTool.input.safeParse({ type: "midi" }).success).toBe(true);
  });
});
