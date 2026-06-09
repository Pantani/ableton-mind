/**
 * Testes da tool create_midi_clip.
 */

import { describe, expect, it, vi } from "vitest";

import { ABLETON_MIND_ERRORS, JsonRpcRemoteError } from "../src/live-client/index.js";
import type { BridgeClient } from "../src/server/context.js";
import { createToolContext } from "../src/server/context.js";
import { createMidiClipTool } from "../src/tools/clip.js";

function bridge(call: BridgeClient["call"]): BridgeClient {
  return { call };
}

describe("createMidiClipTool", () => {
  it("forwards full payload and shapes response", async () => {
    const call = vi.fn(async (method: string, params: unknown) => {
      expect(method).toBe("clip.create_midi");
      expect(params).toEqual({
        track_index: 0,
        clip_slot_index: 0,
        length_beats: 4.0,
        name: "Verse",
      });
      return {
        changed: true,
        clip: {
          track_index: 0,
          clip_slot_index: 0,
          name: "Verse",
          length_beats: 4.0,
        },
      };
    });
    const ctx = createToolContext(bridge(call as BridgeClient["call"]));
    const r = await createMidiClipTool.handler(
      { track_index: 0, clip_slot_index: 0, length_beats: 4.0, name: "Verse" },
      ctx,
    );
    expect(r.clip.name).toBe("Verse");
    expect(r.clip.length_beats).toBe(4.0);
  });

  it("propagates TYPE_MISMATCH error from bridge", async () => {
    const call = vi.fn(async () => {
      throw new JsonRpcRemoteError({
        code: ABLETON_MIND_ERRORS.TYPE_MISMATCH,
        message: "track is not MIDI",
        data: { expected: "midi", actual: "audio", track_index: 0 },
      });
    });
    const ctx = createToolContext(bridge(call as BridgeClient["call"]));
    await expect(
      createMidiClipTool.handler(
        { track_index: 0, clip_slot_index: 0, length_beats: 4.0 },
        ctx,
      ),
    ).rejects.toMatchObject({
      name: "JsonRpcRemoteError",
      code: ABLETON_MIND_ERRORS.TYPE_MISMATCH,
      data: { expected: "midi", actual: "audio", track_index: 0 },
    });
  });

  it("input schema rejects negative indices and zero length", () => {
    const bad1 = createMidiClipTool.input.safeParse({
      track_index: -1,
      clip_slot_index: 0,
      length_beats: 4,
    });
    expect(bad1.success).toBe(false);
    const bad2 = createMidiClipTool.input.safeParse({
      track_index: 0,
      clip_slot_index: 0,
      length_beats: 0,
    });
    expect(bad2.success).toBe(false);
    const good = createMidiClipTool.input.safeParse({
      track_index: 0,
      clip_slot_index: 0,
      length_beats: 4,
    });
    expect(good.success).toBe(true);
  });
});
