/**
 * TD-026 — consolidated tests for Phase 5 (session/preview), Phase 6 (Push),
 * Recipes (loader + runner) and Doctor CLI knowledge/recipes checks.
 *
 * Carry-over from Cycles 9, 10, 11. Established patterns.
 */

import { describe, expect, it, vi } from "vitest";

import { loadAllDevices, loadDevice } from "../src/knowledge/index.js";
import { listRecipes, loadRecipe } from "../src/recipes/index.js";
import { applyRecipe } from "../src/recipes/runner.js";
import type { BridgeClient } from "../src/server/context.js";
import { createToolContext } from "../src/server/context.js";
import { renderPreviewTool, sessionDiffTool, sessionSnapshotTool } from "../src/tools/preview.js";
import { pushSetButtonLedTool, pushSetModeTool, pushSetPadColorTool } from "../src/tools/push.js";
import { applyRecipeTool, listRecipesTool } from "../src/tools/recipe.js";

function bridge(call: BridgeClient["call"]): BridgeClient {
  return { call };
}

// ----- Phase 5 ---------------------------------------------------------------

const SNAP = {
  ts: 100,
  tempo: 128,
  is_playing: false,
  song_time: 0,
  signature_numerator: 4,
  signature_denominator: 4,
  tracks: [
    {
      index: 0,
      name: "Drums",
      color_index: 14,
      is_midi: true,
      is_audio: false,
      mute: false,
      solo: false,
      arm: false,
      volume: 0.85,
      panning: 0,
      clips: [],
      devices: [],
    },
  ],
  total_tracks: 1,
};

describe("sessionSnapshotTool", () => {
  it("forwards include_clips/include_devices with defaults", async () => {
    const call = vi.fn(async (m: string, p: unknown) => {
      expect(m).toBe("session.snapshot");
      expect(p).toEqual({ include_clips: true, include_devices: true });
      return SNAP;
    });
    const ctx = createToolContext(bridge(call as BridgeClient["call"]));
    const r = await sessionSnapshotTool.handler({}, ctx);
    expect(r.tempo).toBe(128);
    expect(r.total_tracks).toBe(1);
  });

  it("respects explicit excludes", async () => {
    const call = vi.fn(async (_m: string, p: unknown) => {
      expect(p).toEqual({ include_clips: false, include_devices: false });
      return { ...SNAP, tracks: [{ ...SNAP.tracks[0], clips: undefined, devices: undefined }] };
    });
    const ctx = createToolContext(bridge(call as BridgeClient["call"]));
    await sessionSnapshotTool.handler({ include_clips: false, include_devices: false }, ctx);
  });
});

describe("sessionDiffTool", () => {
  it("forwards previous snapshot and parses changes", async () => {
    const call = vi.fn(async (m: string, p: unknown) => {
      expect(m).toBe("session.diff");
      expect((p as { previous: unknown }).previous).toEqual(SNAP);
      return {
        from_ts: 100,
        to_ts: 200,
        changes: [{ path: "tempo", before: 128, after: 140, kind: "changed" as const }],
        count: 1,
      };
    });
    const ctx = createToolContext(bridge(call as BridgeClient["call"]));
    const r = await sessionDiffTool.handler({ previous: SNAP }, ctx);
    expect(r.count).toBe(1);
    expect(r.changes[0].path).toBe("tempo");
  });
});

describe("renderPreviewTool", () => {
  it("default mode snapshot, default bars 8", async () => {
    const call = vi.fn(async (_m: string, p: unknown) => {
      expect(p).toEqual({ mode: "snapshot", bars: 8 });
      return { mode: "snapshot" as const, snapshot: SNAP, bars: 8 };
    });
    const ctx = createToolContext(bridge(call as BridgeClient["call"]));
    const r = await renderPreviewTool.handler({}, ctx);
    expect(r.mode).toBe("snapshot");
    expect(r.snapshot).toBeDefined();
  });

  it("input rejects bars 0", () => {
    expect(renderPreviewTool.input.safeParse({ bars: 0 }).success).toBe(false);
    expect(renderPreviewTool.input.safeParse({ bars: 16 }).success).toBe(true);
  });
});

// ----- Phase 6 — Push --------------------------------------------------------

describe("pushSetPadColorTool", () => {
  it("forwards pad/color", async () => {
    const call = vi.fn(async (m: string, p: unknown) => {
      expect(m).toBe("push.set_pad_color");
      expect(p).toEqual({ pad: 36, color: 14 });
      return { pad: 36, color: 14, sent: true };
    });
    const ctx = createToolContext(bridge(call as BridgeClient["call"]));
    const r = await pushSetPadColorTool.handler({ pad: 36, color: 14 }, ctx);
    expect(r.sent).toBe(true);
  });

  it("rejects pad >= 64 and color > 127", () => {
    expect(pushSetPadColorTool.input.safeParse({ pad: 64, color: 0 }).success).toBe(false);
    expect(pushSetPadColorTool.input.safeParse({ pad: 0, color: 200 }).success).toBe(false);
  });
});

describe("pushSetButtonLedTool", () => {
  it("defaults mode to solid", async () => {
    const call = vi.fn(async (_m: string, p: unknown) => {
      expect((p as { mode: string }).mode).toBe("solid");
      return { button: "Play", color: 122, mode: "solid", sent: true };
    });
    const ctx = createToolContext(bridge(call as BridgeClient["call"]));
    await pushSetButtonLedTool.handler({ button: "Play", color: 122 }, ctx);
  });

  it("rejects unknown button name", () => {
    expect(pushSetButtonLedTool.input.safeParse({ button: "Bogus", color: 0 }).success).toBe(false);
  });
});

describe("pushSetModeTool", () => {
  it("forwards mode", async () => {
    const call = vi.fn(async (_m: string, p: unknown) => {
      expect((p as { mode: string }).mode).toBe("session");
      return { mode: "session", sent: true };
    });
    const ctx = createToolContext(bridge(call as BridgeClient["call"]));
    const r = await pushSetModeTool.handler({ mode: "session" }, ctx);
    expect(r.mode).toBe("session");
  });

  it("rejects unknown mode", () => {
    expect(pushSetModeTool.input.safeParse({ mode: "bogus" }).success).toBe(false);
  });
});

// ----- Recipes ---------------------------------------------------------------

describe("recipe loader + runner", () => {
  it("listRecipes finds at least 5 recipes embedded", async () => {
    const recipes = await listRecipes();
    expect(recipes.length).toBeGreaterThanOrEqual(5);
    const ids = recipes.map((r) => r.id);
    expect(ids).toContain("drums/tech-house-kick");
    expect(ids).toContain("bass/sub-808");
    expect(ids).toContain("mixing/master-bus");
  });

  it("loadRecipe parses canonical recipe", async () => {
    const r = await loadRecipe("drums/tech-house-kick");
    expect(r.name).toBe("Tech-House Kick");
    expect(r.steps.length).toBeGreaterThan(0);
  });

  it("applyRecipe substitutes inputs and calls bridge per step", async () => {
    const calls: Array<{ method: string; params: unknown }> = [];
    const fakeBridge: BridgeClient = {
      call: async (method: string, params: unknown) => {
        calls.push({ method, params });
        if (method === "track.upsert") {
          return {
            changed: true,
            track: { index: 5, name: "Kick", is_midi: true, is_audio: false },
          };
        }
        return {};
      },
    };
    const recipe = await loadRecipe("drums/tech-house-kick");
    const r = await applyRecipe(recipe, { tune_semitones: -3 }, fakeBridge);
    expect(r.applied).toBe(true);
    expect(r.completed).toBe(recipe.steps.length);
    // Confirms that tune_semitones=-3 was substituted.
    const tuneCall = calls.find(
      (c) => (c.params as { parameter_name?: string }).parameter_name === "Tune",
    );
    expect((tuneCall?.params as { value: number }).value).toBe(-3);
    // Confirms that dotted-let `kick.track.index` resolved to 5.
    const clipCall = calls.find((c) => c.method === "clip.create_midi");
    expect((clipCall?.params as { track_index: number }).track_index).toBe(5);
  });

  it("applyRecipe stops on step failure and reports progress", async () => {
    const fakeBridge: BridgeClient = {
      call: async (method: string) => {
        if (method === "browser.load_item") {
          throw new Error("Push not loaded");
        }
        if (method === "track.upsert") {
          return { changed: true, track: { index: 0, name: "X", is_midi: true, is_audio: false } };
        }
        return {};
      },
    };
    const recipe = await loadRecipe("drums/tech-house-kick");
    const r = await applyRecipe(recipe, {}, fakeBridge);
    expect(r.applied).toBe(false);
    expect(r.failed_at).toBe(1); // step 1 = browser.load_item
    expect(r.error).toMatch(/Push not loaded/);
  });
});

describe("listRecipesTool + applyRecipeTool", () => {
  it("listRecipesTool filters by category", async () => {
    const ctx = createToolContext({ call: async () => ({}) });
    const r = await listRecipesTool.handler({ category: "drums" }, ctx);
    expect(r.total).toBeGreaterThanOrEqual(1);
    expect(r.recipes.every((rc) => rc.category === "drums")).toBe(true);
  });

  it("applyRecipeTool returns ok=true on full apply", async () => {
    const ctx = createToolContext({
      call: async (method: string) => {
        if (method === "track.upsert") {
          return { changed: true, track: { index: 0, name: "X", is_midi: true, is_audio: false } };
        }
        return {};
      },
    });
    const r = await applyRecipeTool.handler(
      { recipe_id: "drums/tech-house-kick", overrides: {} },
      ctx,
    );
    expect(r.ok).toBe(true);
    expect(r.applied).toBe(true);
  });
});

// ----- Knowledge (Doctor CLI smoke) -----------------------------------------

describe("knowledge base integrity", () => {
  it("loadAllDevices loads all KNOWN_DEVICES without throwing", async () => {
    const devices = await loadAllDevices();
    expect(devices.length).toBeGreaterThanOrEqual(28);
    // Each device has id + non-empty parameters.
    for (const d of devices) {
      expect(d.id).toMatch(/^ableton\./);
      expect(Array.isArray(d.parameters)).toBe(true);
    }
  });

  it("loadDevice('wavetable') has 60 params + modulation_matrix", async () => {
    const wt = await loadDevice("wavetable");
    expect(wt.parameters.length).toBeGreaterThanOrEqual(60);
    expect(wt.modulation_matrix?.slots).toBe(16);
  });

  it("loadDevice('drum_rack') has drum_pads metadata (passthrough)", async () => {
    const dr = await loadDevice("drum_rack");
    expect((dr as unknown as { drum_pads: unknown }).drum_pads).toBeDefined();
  });
});
