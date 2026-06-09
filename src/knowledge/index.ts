/**
 * Knowledge base loader.
 *
 * Carrega JSONs estáticos embarcados no pacote npm. Não toca rede, não toca FS
 * em runtime (tudo via `import.meta.url` no build).
 *
 * Phase 3 expande: 50+ devices, packs, grooves, MIDI standards.
 */

import { readFile } from "node:fs/promises";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";

import { z } from "zod";

const KNOWLEDGE_DIR = dirname(fileURLToPath(import.meta.url));

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

// ----- Loaders ---------------------------------------------------------------

async function readJson(rel: string): Promise<unknown> {
  const buf = await readFile(join(KNOWLEDGE_DIR, rel), "utf8");
  return JSON.parse(buf);
}

/** Carrega o schema de UM device por id (= filename sem .json). */
export async function loadDevice(id: string): Promise<DeviceSchema> {
  const raw = await readJson(`devices/${id}.json`);
  return deviceSchema.parse(raw);
}

/** Carrega TODOS os devices listados em `devices/_index.json` (ou conhecidos). */
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

/** Lookup: dado um device id e um param name, devolve o parameter schema (ou null). */
export function findParameter(device: DeviceSchema, name: string) {
  return device.parameters.find((p) => p.name === name) ?? null;
}
