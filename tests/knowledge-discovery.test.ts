import { readFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";

import { describe, expect, it } from "vitest";

const REPO_ROOT = join(dirname(fileURLToPath(import.meta.url)), "..");

describe("Phase 8 discovery metadata", () => {
  it("loads compact canonical labels for plug-ins, Max for Live, and Link", async () => {
    const knowledge = await import("../src/knowledge/index.js");
    const loader = (
      knowledge as {
        loadDiscoveryMetadata?: () => Promise<{
          plugin_formats: Array<{ id: string; label: string; platform: string }>;
          m4l_capabilities: Array<{ id: string; label: string; phase8_slice1: string }>;
          link_status_fields: Array<{ id: string; label: string; availability: string }>;
        }>;
      }
    ).loadDiscoveryMetadata;

    expect(loader).toBeTypeOf("function");
    if (!loader) return;

    const metadata = await loader();

    expect(metadata.plugin_formats.map((format) => format.id)).toEqual([
      "ableton_native",
      "max_for_live",
      "vst2",
      "vst3",
      "audio_unit_v2",
      "audio_unit_v3",
      "unknown",
    ]);
    expect(metadata.plugin_formats).toHaveLength(7);
    expect(metadata.m4l_capabilities.map((capability) => capability.id)).toEqual([
      "patcher_metadata",
      "exposed_parameters",
      "live_api_paths",
      "dependencies",
    ]);
    expect(
      metadata.m4l_capabilities.every((capability) => capability.phase8_slice1 === "read_only"),
    ).toBe(true);
    expect(metadata.link_status_fields.map((field) => field.id)).toEqual([
      "available",
      "enabled",
      "num_peers",
      "start_stop_sync",
      "link_audio",
      "reason",
    ]);
    expect(
      metadata.link_status_fields.every((field) => field.availability === "runtime_reported"),
    ).toBe(true);
  });

  it("copies discovery metadata into dist with the other runtime knowledge assets", () => {
    const copyScript = readFileSync(join(REPO_ROOT, "scripts/copy-assets.mjs"), "utf8");
    expect(copyScript).toContain('copyFile("src/knowledge/discovery.json", "discovery.json")');
  });
});
