/**
 * Knowledge base loader.
 *
 * Loads static JSONs embedded in the npm package. Doesn't touch the network,
 * doesn't touch the FS at runtime (everything via `import.meta.url` at build).
 *
 * Phase 3 expands: 50+ devices, packs, grooves, MIDI standards.
 */

import { readFile, stat } from "node:fs/promises";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";

import { z } from "zod";

const HERE = dirname(fileURLToPath(import.meta.url));
const KNOWLEDGE_DIR_CANDIDATES = [HERE, join(HERE, "..")];

// ----- Schemas ---------------------------------------------------------------

const parameterSchema = z.object({
  index: z.number().int().nonnegative(),
  name: z.string(),
  min: z.number(),
  max: z.number(),
  default: z.number(),
  unit: z.string().optional(),
  automatable: z.boolean().optional(),
  modulatable: z.boolean().optional(),
  description: z.string().optional(),
});

const modulationMatrixSchema = z
  .object({
    slots: z.number().int().positive(),
    sources: z.array(z.string()),
    targets_hint: z.string().optional(),
  })
  .optional();

export const deviceSchema = z
  .object({
    $schema: z.string().optional(),
    id: z.string(),
    name: z.string(),
    category: z.enum(["instrument", "audio_effect", "midi_effect", "drum_rack", "rack"]),
    vendor: z.string(),
    live_version_min: z.string(),
    description: z.string().optional(),
    source: z.string().optional(),
    completeness: z.enum(["partial", "complete", "stub"]).optional(),
    parameters: z.array(parameterSchema),
    modulation_matrix: modulationMatrixSchema,
    presets_path: z.string().optional(),
    todo: z.array(z.string()).optional(),
  })
  // Devices like drum_rack carry extra device-specific fields (drum_pads,
  // chain_routing, etc). `.passthrough()` preserves them without forcing
  // each device to extend the schema.
  .passthrough();

export type DeviceSchema = z.infer<typeof deviceSchema>;

export const scaleSchema = z.object({
  name: z.string(),
  intervals: z.array(z.number().int().min(0).max(11)),
});

export const scalesSchema = z.object({
  $schema: z.string().optional(),
  version: z.string(),
  source: z.string().optional(),
  scales: z.array(scaleSchema),
  root_notes: z.array(z.object({ name: z.string(), midi: z.number().int().min(0).max(11) })),
});

export type ScalesPayload = z.infer<typeof scalesSchema>;

const discoveryReferenceSchema = z.object({
  title: z.string(),
  url: z.string().url(),
});

const pluginFormatSchema = z.object({
  id: z.enum([
    "ableton_native",
    "max_for_live",
    "vst2",
    "vst3",
    "audio_unit_v2",
    "audio_unit_v3",
    "unknown",
  ]),
  label: z.string(),
  platform: z.enum(["all", "macos", "windows", "unknown"]),
  device_kind: z.enum(["native", "max_for_live", "third_party", "unknown"]),
  description: z.string(),
});

const m4lCapabilitySchema = z.object({
  id: z.enum(["patcher_metadata", "exposed_parameters", "live_api_paths", "dependencies"]),
  label: z.string(),
  phase8_slice1: z.literal("read_only"),
  description: z.string(),
});

const linkStatusFieldSchema = z.object({
  id: z.enum(["available", "enabled", "num_peers", "start_stop_sync", "link_audio", "reason"]),
  label: z.string(),
  availability: z.literal("runtime_reported"),
  description: z.string(),
});

export const discoveryMetadataSchema = z.object({
  $schema: z.string().optional(),
  version: z.string(),
  source: z.string(),
  references: z.array(discoveryReferenceSchema),
  plugin_formats: z.array(pluginFormatSchema),
  m4l_capabilities: z.array(m4lCapabilitySchema),
  link_status_fields: z.array(linkStatusFieldSchema),
});

export type DiscoveryMetadata = z.infer<typeof discoveryMetadataSchema>;

// ----- Loaders ---------------------------------------------------------------

let cachedKnowledgeRoot: string | null = null;
async function knowledgeRoot(): Promise<string> {
  if (cachedKnowledgeRoot) return cachedKnowledgeRoot;
  for (const candidate of KNOWLEDGE_DIR_CANDIDATES) {
    try {
      const [devices, scales] = await Promise.all([
        stat(join(candidate, "devices")),
        stat(join(candidate, "scales.json")),
      ]);
      if (devices.isDirectory() && scales.isFile()) {
        cachedKnowledgeRoot = candidate;
        return candidate;
      }
    } catch {
      // Not this bundle shape; try the next candidate.
    }
  }
  cachedKnowledgeRoot = HERE;
  return HERE;
}

async function readJson(rel: string): Promise<unknown> {
  const buf = await readFile(join(await knowledgeRoot(), rel), "utf8");
  return JSON.parse(buf);
}

/** Loads the schema of ONE device by id (= filename without .json). */
export async function loadDevice(id: string): Promise<DeviceSchema> {
  const raw = await readJson(`devices/${id}.json`);
  return deviceSchema.parse(raw);
}

/** Loads ALL devices listed in `devices/_index.json` (or known ones). */
const KNOWN_DEVICES = [
  "wavetable",
  "operator",
  "eq_eight",
  "compressor",
  "reverb",
  "auto_filter",
  "echo",
  "saturator",
  "delay",
  "drum_rack",
  "drum_cell",
  "simpler",
  "sampler",
  "tuner",
  "phaser_flanger",
  "limiter",
  "glue_compressor",
  "bass",
  "drift",
  "hybrid_reverb",
  "pedal",
  "beat_repeat",
  "vocoder",
  "roar",
  "erosion",
  "gate",
  "auto_pan",
  "frequency_shifter",
  "looper",
  "spectral_resonator",
  "spectral_time",
  "shifter",
  "chorus_ensemble",
  "meld",
  "pitch",
  "multiband_dynamics",
  "eq_three",
  "vinyl_distortion",
  "drum_buss",
  "redux",
  "cabinet",
  "dynamic_tube",
  "filter_delay",
  "grain_delay",
  "utility",
  "arpeggiator",
  "spectrum",
  "resonators",
  "external_audio_effect",
  "channel_eq",
  "chord",
  "note_length",
  "random",
  "scale",
  "velocity",
];

export async function loadAllDevices(): Promise<DeviceSchema[]> {
  const results = await Promise.all(KNOWN_DEVICES.map((id) => loadDevice(id)));
  return results;
}

export async function loadScales(): Promise<ScalesPayload> {
  const raw = await readJson("scales.json");
  return scalesSchema.parse(raw);
}

export async function loadDiscoveryMetadata(): Promise<DiscoveryMetadata> {
  const raw = await readJson("discovery.json");
  return discoveryMetadataSchema.parse(raw);
}

/** Lookup: given a device id and a param name, returns the parameter schema (or null). */
export function findParameter(device: DeviceSchema, name: string) {
  return device.parameters.find((p) => p.name === name) ?? null;
}
