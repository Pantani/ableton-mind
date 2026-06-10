/**
 * TD-044 — MCP Prompts subsystem tests (Cycle 18).
 *
 * Prompts are pure (no side effects) — we test:
 *  - Registry: allPrompts has 5 entries, each with a unique name + valid args.
 *  - Each handler renders messages[0].content.text containing the substitutions.
 *  - listPromptsTool returns metadata without calling the bridge.
 */

import { describe, expect, it } from "vitest";

import {
  allPrompts,
  arrangementPrompt,
  genreTrackPrompt,
  loadPrompt,
  mixChainPrompt,
  soundDesignPrompt,
  vocalChainPrompt,
} from "../src/prompts/index.js";
import { createToolContext } from "../src/server/context.js";
import { listPromptsTool } from "../src/tools/prompts.js";

describe("prompts registry", () => {
  it("exposes 5 unique prompts", () => {
    expect(allPrompts).toHaveLength(5);
    const names = allPrompts.map((p) => p.name);
    expect(new Set(names).size).toBe(names.length);
    expect(names).toEqual([
      "create_genre_track",
      "build_mix_chain",
      "build_arrangement",
      "sound_design_session",
      "process_vocal_take",
    ]);
  });

  it("loadPrompt returns null for unknown", () => {
    expect(loadPrompt("bogus")).toBeNull();
    expect(loadPrompt("create_genre_track")).toBe(genreTrackPrompt);
  });

  it("every prompt has at least 1 required arg", () => {
    for (const p of allPrompts) {
      expect(p.arguments.some((a) => a.required)).toBe(true);
      expect(p.description.length).toBeGreaterThan(20);
    }
  });
});

describe("genreTrackPrompt", () => {
  it("substitutes genre + tempo defaults", () => {
    const r = genreTrackPrompt.handler({ genre: "techno" });
    const text = r.messages[0].content.text;
    expect(text).toContain("techno");
    expect(text).toMatch(/130 BPM/);
    expect(text).toContain("apply_recipe");
    expect(text).toContain("session_snapshot");
  });

  it("falls back to 120 BPM for unknown genre", () => {
    const r = genreTrackPrompt.handler({ genre: "polka" });
    expect(r.messages[0].content.text).toMatch(/120 BPM/);
  });

  it("honors custom tempo override", () => {
    const r = genreTrackPrompt.handler({ genre: "techno", tempo: "145" });
    expect(r.messages[0].content.text).toMatch(/145 BPM/);
  });

  it("falls back to defaults when genre missing", () => {
    const r = genreTrackPrompt.handler({});
    const text = r.messages[0].content.text;
    expect(text).toContain("techno");
  });
});

describe("mixChainPrompt", () => {
  it("returns drums recipe references", () => {
    const r = mixChainPrompt.handler({ source: "drums", track_index: "3" });
    const text = r.messages[0].content.text;
    expect(text).toContain("racks/parallel-comp");
    expect(text).toContain("track_index: 3");
    expect(text).toContain("device_get_parameters");
  });

  it("master maps to mixing/master-bus", () => {
    const r = mixChainPrompt.handler({ source: "master" });
    expect(r.messages[0].content.text).toContain("mixing/master-bus");
    expect(r.messages[0].content.text).toContain("Spectrum");
  });

  it("unknown source falls back to list_recipes hint", () => {
    const r = mixChainPrompt.handler({ source: "synth" });
    expect(r.messages[0].content.text).toContain("list_recipes");
  });
});

describe("arrangementPrompt", () => {
  it("intro-build-drop-break-outro renders 5 sections", () => {
    const r = arrangementPrompt.handler({
      structure: "intro-build-drop-break-outro",
      tempo: "128",
      bars_per_section: "8",
    });
    const text = r.messages[0].content.text;
    expect(text).toContain("Intro");
    expect(text).toContain("Drop");
    expect(text).toContain("Outro");
    expect(text).toMatch(/length_beats=32/);
  });

  it("aaba renders 4 sections", () => {
    const r = arrangementPrompt.handler({ structure: "aaba" });
    const text = r.messages[0].content.text;
    expect(text).toContain("A1");
    expect(text).toContain("A2");
    expect(text).toContain("B");
    expect(text).toContain("A3");
  });

  it("verse-chorus renders 8 sections", () => {
    const r = arrangementPrompt.handler({ structure: "verse-chorus" });
    const text = r.messages[0].content.text;
    expect(text).toContain("Verse 1");
    expect(text).toContain("Chorus 3");
  });
});

describe("soundDesignPrompt", () => {
  it("renders starting params for pad target", () => {
    const r = soundDesignPrompt.handler({ synth: "wavetable", target: "pad" });
    const text = r.messages[0].content.text;
    expect(text).toContain("Env 1 Attack: 2-5s");
    expect(text).toContain("browser.load_item");
    expect(text).toContain("device_get_parameters");
  });

  it("renders starting params for bass target", () => {
    const r = soundDesignPrompt.handler({ synth: "operator", target: "bass" });
    expect(r.messages[0].content.text).toContain("Sub Gain");
  });

  it("unknown target falls back to explore hint", () => {
    const r = soundDesignPrompt.handler({ synth: "drift", target: "unicorn" });
    expect(r.messages[0].content.text).toContain("Explore params via");
  });
});

describe("vocalChainPrompt", () => {
  it("renders recipe + tweak hints", () => {
    const r = vocalChainPrompt.handler({ track_index: "2" });
    const text = r.messages[0].content.text;
    expect(text).toContain("mixing/vocal-chain");
    expect(text).toContain("track_index: 2");
  });
});

describe("listPromptsTool", () => {
  it("returns 5 prompts with metadata", async () => {
    const ctx = createToolContext({ call: async () => ({}) });
    const r = await listPromptsTool.handler({}, ctx);
    expect(r.total).toBe(5);
    expect(r.prompts).toHaveLength(5);
    for (const p of r.prompts) {
      expect(p.name).toBeTruthy();
      expect(p.arguments.length).toBeGreaterThan(0);
    }
  });
});
