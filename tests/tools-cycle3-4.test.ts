/**
 * Cobertura consolidada das tools do Cycle 3 + Cycle 4 que ficaram sem teste
 * em ciclos anteriores (TD-010).
 *
 * Tools cobertas aqui:
 *   Cycle 3:
 *     - trackUpsertTool, trackSetNameTool, trackSetVolumeTool
 *     - clipAddNotesTool, clipFireTool, clipStopTool, clipSetNameTool
 *     - sessionGetInfoTool, browserGetCategoriesTool
 *   Cycle 4:
 *     - trackGetInfoTool, sceneFireTool, clipSetLoopTool
 *
 * Padrão: BridgeClient mockado via vi.fn. Sem rede real.
 */

import { describe, expect, it, vi } from "vitest";

import { ABLETON_MIND_ERRORS, JsonRpcRemoteError } from "../src/live-client/index.js";
import type { BridgeClient } from "../src/server/context.js";
import { createToolContext } from "../src/server/context.js";
import {
  browserGetCategoriesTool,
  clipAddNotesTool,
  clipFireTool,
  clipSetLoopTool,
  clipSetNameTool,
  clipStopTool,
  sceneFireTool,
  sessionGetInfoTool,
  trackGetInfoTool,
  trackSetNameTool,
  trackSetVolumeTool,
  trackUpsertTool,
} from "../src/tools/index.js";
import { allTools } from "../src/tools/index.js";

function bridge(call: BridgeClient["call"]): BridgeClient {
  return { call };
}

// ----- Cycle 3 — track -------------------------------------------------------

describe("trackUpsertTool", () => {
  it("returns changed=true when created", async () => {
    const call = vi.fn(async (m: string, p: unknown) => {
      expect(m).toBe("track.upsert");
      expect(p).toEqual({ name: "Pad", type: "midi", index: undefined });
      return {
        changed: true,
        track: { index: 3, name: "Pad", is_midi: true, is_audio: false },
      };
    });
    const ctx = createToolContext(bridge(call as BridgeClient["call"]));
    const r = await trackUpsertTool.handler({ name: "Pad", type: "midi" }, ctx);
    expect(r.changed).toBe(true);
    expect(r.track.name).toBe("Pad");
  });

  it("returns changed=false when name exists", async () => {
    const call = vi.fn(async () => ({
      changed: false,
      track: { index: 0, name: "Drums", is_midi: true, is_audio: false },
    }));
    const ctx = createToolContext(bridge(call as BridgeClient["call"]));
    const r = await trackUpsertTool.handler({ name: "Drums", type: "midi" }, ctx);
    expect(r.changed).toBe(false);
  });

  it("input schema requires non-empty name", () => {
    expect(trackUpsertTool.input.safeParse({ name: "", type: "midi" }).success).toBe(false);
    expect(trackUpsertTool.input.safeParse({ name: "X", type: "midi" }).success).toBe(true);
  });
});

describe("trackSetNameTool", () => {
  it("renames and returns before/after", async () => {
    const call = vi.fn(async (m: string, p: unknown) => {
      expect(m).toBe("track.set_name");
      expect(p).toEqual({ index: 0, name: "Kick" });
      return { changed: true, before: "Drums", after: "Kick" };
    });
    const ctx = createToolContext(bridge(call as BridgeClient["call"]));
    const r = await trackSetNameTool.handler({ index: 0, name: "Kick" }, ctx);
    expect(r.after).toBe("Kick");
  });
});

describe("trackSetVolumeTool", () => {
  it("forwards volume and gets dB back", async () => {
    const call = vi.fn(async () => ({
      changed: true,
      before: 0.85,
      after: 0.5,
      before_db: 0,
      after_db: -16,
    }));
    const ctx = createToolContext(bridge(call as BridgeClient["call"]));
    const r = await trackSetVolumeTool.handler({ index: 0, volume: 0.5 }, ctx);
    expect(r.after_db).toBeCloseTo(-16, 1);
  });

  it("rejects volume out of 0..1", () => {
    expect(trackSetVolumeTool.input.safeParse({ index: 0, volume: 1.5 }).success).toBe(false);
    expect(trackSetVolumeTool.input.safeParse({ index: 0, volume: -0.1 }).success).toBe(false);
  });
});

// ----- Cycle 3 — clip --------------------------------------------------------

describe("clipAddNotesTool", () => {
  it("forwards notes array", async () => {
    const call = vi.fn(async (m: string, p: unknown) => {
      expect(m).toBe("clip.add_notes");
      const params = p as { notes: unknown[] };
      expect(params.notes).toHaveLength(2);
      return { changed: true, added: 2, track_index: 0, clip_slot_index: 0 };
    });
    const ctx = createToolContext(bridge(call as BridgeClient["call"]));
    const r = await clipAddNotesTool.handler(
      {
        track_index: 0,
        clip_slot_index: 0,
        notes: [
          { pitch: 60, start: 0, duration: 0.5 },
          { pitch: 64, start: 0.5, duration: 0.5, velocity: 80 },
        ],
      },
      ctx,
    );
    expect(r.added).toBe(2);
  });

  it("input schema rejects empty notes and OOR pitch", () => {
    expect(
      clipAddNotesTool.input.safeParse({
        track_index: 0,
        clip_slot_index: 0,
        notes: [],
      }).success,
    ).toBe(false);
    expect(
      clipAddNotesTool.input.safeParse({
        track_index: 0,
        clip_slot_index: 0,
        notes: [{ pitch: 200, start: 0, duration: 1 }],
      }).success,
    ).toBe(false);
  });
});

describe("clipFireTool + clipStopTool", () => {
  it("fire returns is_playing=true", async () => {
    const call = vi.fn(async () => ({
      changed: true,
      is_playing: true,
      track_index: 0,
      clip_slot_index: 0,
    }));
    const ctx = createToolContext(bridge(call as BridgeClient["call"]));
    const r = await clipFireTool.handler({ track_index: 0, clip_slot_index: 0 }, ctx);
    expect(r.is_playing).toBe(true);
  });

  it("stop returns is_playing=false", async () => {
    const call = vi.fn(async () => ({
      changed: true,
      is_playing: false,
      track_index: 0,
      clip_slot_index: 0,
    }));
    const ctx = createToolContext(bridge(call as BridgeClient["call"]));
    const r = await clipStopTool.handler({ track_index: 0, clip_slot_index: 0 }, ctx);
    expect(r.is_playing).toBe(false);
  });
});

describe("clipSetNameTool", () => {
  it("renames", async () => {
    const call = vi.fn(async () => ({ changed: true, before: "Verse", after: "Chorus" }));
    const ctx = createToolContext(bridge(call as BridgeClient["call"]));
    const r = await clipSetNameTool.handler(
      { track_index: 0, clip_slot_index: 0, name: "Chorus" },
      ctx,
    );
    expect(r.after).toBe("Chorus");
  });
});

// ----- Cycle 3 — session / browser -------------------------------------------

describe("sessionGetInfoTool", () => {
  it("returns top-level snapshot", async () => {
    const call = vi.fn(async () => ({
      name: "Untitled",
      num_tracks: 4,
      num_return_tracks: 2,
      has_master: true,
      tempo: 128,
      time_signature: { numerator: 4, denominator: 4 },
      is_playing: false,
      song_time: 0,
      song_length: 0,
      root_note: 0,
      scale_name: "Major",
    }));
    const ctx = createToolContext(bridge(call as BridgeClient["call"]));
    const r = await sessionGetInfoTool.handler({}, ctx);
    expect(r.num_tracks).toBe(4);
    expect(r.time_signature.numerator).toBe(4);
  });
});

describe("browserGetCategoriesTool", () => {
  it("returns available=false in headless", async () => {
    const call = vi.fn(async () => ({
      categories: [],
      available: false,
      reason: "browser unavailable (headless/no app)",
    }));
    const ctx = createToolContext(bridge(call as BridgeClient["call"]));
    const r = await browserGetCategoriesTool.handler({}, ctx);
    expect(r.available).toBe(false);
    expect(r.categories).toEqual([]);
  });

  it("returns categories when available", async () => {
    const call = vi.fn(async () => ({
      categories: [
        { key: "instruments", name: "Instruments", is_folder: true, is_loadable: false },
        { key: "audio_effects", name: "Audio Effects", is_folder: true, is_loadable: false },
      ],
      available: true,
    }));
    const ctx = createToolContext(bridge(call as BridgeClient["call"]));
    const r = await browserGetCategoriesTool.handler({}, ctx);
    expect(r.available).toBe(true);
    expect(r.categories).toHaveLength(2);
  });
});

// ----- Cycle 4 ---------------------------------------------------------------

describe("trackGetInfoTool", () => {
  it("returns detail with dB approximation", async () => {
    const call = vi.fn(async () => ({
      index: 0,
      name: "Drums",
      color_index: 14,
      is_midi: true,
      is_audio: false,
      mute: false,
      solo: false,
      arm: false,
      volume: 0.85,
      volume_db: 0,
      panning: 0,
      num_sends: 0,
      num_clip_slots: 8,
      num_clips: 1,
      num_devices: 2,
    }));
    const ctx = createToolContext(bridge(call as BridgeClient["call"]));
    const r = await trackGetInfoTool.handler({ index: 0 }, ctx);
    expect(r.name).toBe("Drums");
    expect(r.num_clips).toBe(1);
    expect(r.volume_db).toBe(0);
  });
});

describe("sceneFireTool", () => {
  it("fires a scene", async () => {
    const call = vi.fn(async (m: string, p: unknown) => {
      expect(m).toBe("scene.fire");
      expect(p).toEqual({ index: 1 });
      return { changed: true, index: 1, name: "Drop" };
    });
    const ctx = createToolContext(bridge(call as BridgeClient["call"]));
    const r = await sceneFireTool.handler({ index: 1 }, ctx);
    expect(r.name).toBe("Drop");
  });

  it("propagates OBJECT_NOT_FOUND on bad index", async () => {
    const call = vi.fn(async () => {
      throw new JsonRpcRemoteError({
        code: ABLETON_MIND_ERRORS.OBJECT_NOT_FOUND,
        message: "scene not found",
        data: { num_scenes: 0, got: 5 },
      });
    });
    const ctx = createToolContext(bridge(call as BridgeClient["call"]));
    await expect(sceneFireTool.handler({ index: 5 }, ctx)).rejects.toMatchObject({
      code: ABLETON_MIND_ERRORS.OBJECT_NOT_FOUND,
    });
  });
});

describe("clipSetLoopTool", () => {
  it("forwards partial fields", async () => {
    const call = vi.fn(async (m: string, p: unknown) => {
      expect(m).toBe("clip.set_loop");
      expect(p).toMatchObject({ track_index: 0, clip_slot_index: 0, loop_end: 2 });
      return {
        changed: true,
        before: { loop_start: 0, loop_end: 4, looping: true },
        after: { loop_start: 0, loop_end: 2, looping: true },
      };
    });
    const ctx = createToolContext(bridge(call as BridgeClient["call"]));
    const r = await clipSetLoopTool.handler(
      { track_index: 0, clip_slot_index: 0, loop_end: 2 },
      ctx,
    );
    expect(r.after.loop_end).toBe(2);
    expect(r.after.looping).toBe(true);
  });

  it("input schema rejects negative loop_start and zero loop_end", () => {
    expect(
      clipSetLoopTool.input.safeParse({
        track_index: 0,
        clip_slot_index: 0,
        loop_start: -1,
      }).success,
    ).toBe(false);
    expect(
      clipSetLoopTool.input.safeParse({
        track_index: 0,
        clip_slot_index: 0,
        loop_end: 0,
      }).success,
    ).toBe(false);
  });
});

// ----- Registry smoke --------------------------------------------------------

describe("allTools registry", () => {
  it("exposes 18 tools", () => {
    const names = allTools.map((t) => t.name).sort();
    expect(names).toEqual(
      [
        "browser_get_categories",
        "clip_add_notes",
        "clip_fire",
        "clip_set_loop",
        "clip_set_name",
        "clip_stop",
        "create_midi_clip",
        "play",
        "scene_fire",
        "session_get_info",
        "set_tempo",
        "stop",
        "track_create",
        "track_get_info",
        "track_list",
        "track_set_name",
        "track_set_volume",
        "track_upsert",
      ].sort(),
    );
  });

  it("every tool has unique name", () => {
    const set = new Set(allTools.map((t) => t.name));
    expect(set.size).toBe(allTools.length);
  });
});
