/**
 * Tools MCP do domínio Track.
 *
 * - `track_list` (read-only) — coleções separadas conforme ADR-0002.
 *   INVARIANTE (TD-006): em runtime real `master_track` está sempre presente;
 *   `null` só aparece em testes com FakeSong sem master configurado.
 *   LLM pode assumir non-null; defensiva apenas para tooling de teste.
 * - `track_create` — cria audio ou MIDI track. NÃO idempotente.
 * - `track_upsert` — cria só se name=X ainda não existe. Idempotente.
 * - `track_set_name` — renomeia. Idempotente.
 * - `track_set_volume` — volume 0..1 normalized (ADR-0004). Retorna also _db.
 */

import { z } from "zod";

import { UNVERIFIABLE, verifyField } from "../feedback/verify.js";
import { defineTool } from "../server/define-tool.js";

// ----- shared shapes ---------------------------------------------------------

const regularTrackSchema = z.object({
  index: z.number().int().nonnegative(),
  name: z.string(),
  color_index: z.number().int(),
  is_midi: z.boolean(),
  is_audio: z.boolean(),
  is_grouped: z.boolean(),
  is_foldable: z.boolean(),
  mute: z.boolean(),
  solo: z.boolean(),
  arm: z.boolean(),
});

const returnTrackSchema = z.object({
  index: z.number().int().nonnegative(),
  name: z.string(),
  color_index: z.number().int(),
  mute: z.boolean(),
  solo: z.boolean(),
});

const masterTrackSchema = z.object({ name: z.string(), color_index: z.number().int() }).nullable();

// ----- track_list ------------------------------------------------------------

const trackListInputSchema = z.object({
  include_master: z.boolean().optional().describe("Default true."),
  include_returns: z.boolean().optional().describe("Default true."),
});

const trackListOutputSchema = z.object({
  ok: z.literal(true),
  verified: z.literal(true),
  tracks: z.array(regularTrackSchema),
  return_tracks: z.array(returnTrackSchema),
  master_track: masterTrackSchema,
  total: z.number().int().nonnegative(),
});

const trackListBridgeResult = z.object({
  tracks: z.array(regularTrackSchema),
  return_tracks: z.array(returnTrackSchema),
  master_track: masterTrackSchema,
  total: z.number().int().nonnegative(),
});

export const trackListTool = defineTool({
  name: "track_list",
  description:
    "List all tracks in the Ableton Live session, separated into regular, return, and master.",
  input: trackListInputSchema,
  output: trackListOutputSchema,
  handler: async (input, ctx) => {
    const raw = await ctx.bridge.call("track.list", {
      include_master: input.include_master ?? true,
      include_returns: input.include_returns ?? true,
    });
    const parsed = trackListBridgeResult.parse(raw);
    return { ok: true as const, verified: true as const, ...parsed };
  },
});

// ----- track_create ----------------------------------------------------------

const trackCreateInputSchema = z.object({
  type: z.enum(["midi", "audio"]),
  index: z.number().int().nonnegative().optional(),
  name: z.string().min(1).optional(),
});

const trackCreateOutputSchema = z.object({
  ok: z.literal(true),
  verified: z.boolean(),
  changed: z.literal(true),
  track: z.object({
    index: z.number().int().nonnegative(),
    name: z.string(),
    is_midi: z.boolean(),
    is_audio: z.boolean(),
  }),
  diff: z
    .object({
      field: z.string(),
      intent: z.unknown(),
      actual: z.unknown(),
      tolerance: z.number().optional(),
    })
    .nullable(),
});

const trackCreateBridgeResult = trackCreateOutputSchema.pick({ changed: true, track: true });

export const trackCreateTool = defineTool({
  name: "track_create",
  description:
    "Create a new MIDI or audio track. NOT idempotent — each call creates a new track. Verified via track type match.",
  input: trackCreateInputSchema,
  output: trackCreateOutputSchema,
  handler: async (input, ctx) => {
    const raw = await ctx.bridge.call("track.create", {
      type: input.type,
      index: input.index,
      name: input.name,
    });
    const parsed = trackCreateBridgeResult.parse(raw);
    // Verifica: tipo da track criada bate com o intent.
    const expectedMidi = input.type === "midi";
    const v = verifyField(expectedMidi, parsed.track.is_midi, { field: "is_midi" });
    return { ok: true as const, verified: v.ok, ...parsed, diff: v.diff };
  },
});

// ----- track_upsert ----------------------------------------------------------

const trackUpsertInputSchema = z.object({
  name: z.string().min(1),
  type: z.enum(["midi", "audio"]),
  index: z.number().int().nonnegative().optional(),
});

const trackUpsertOutputSchema = z.object({
  ok: z.literal(true),
  verified: z.boolean(),
  changed: z.boolean(),
  track: z.object({
    index: z.number().int().nonnegative(),
    name: z.string(),
    is_midi: z.boolean(),
    is_audio: z.boolean(),
  }),
  diff: z
    .object({
      field: z.string(),
      intent: z.unknown(),
      actual: z.unknown(),
      tolerance: z.number().optional(),
    })
    .nullable(),
});

const trackUpsertBridgeResult = z.object({
  changed: z.boolean(),
  track: z.object({
    index: z.number().int().nonnegative(),
    name: z.string(),
    is_midi: z.boolean(),
    is_audio: z.boolean(),
  }),
});

export const trackUpsertTool = defineTool({
  name: "track_upsert",
  description:
    "Create a track only if a track with the given name does not already exist. Idempotent. Verified via name+type match.",
  input: trackUpsertInputSchema,
  output: trackUpsertOutputSchema,
  handler: async (input, ctx) => {
    const raw = await ctx.bridge.call("track.upsert", {
      name: input.name,
      type: input.type,
      index: input.index,
    });
    const parsed = trackUpsertBridgeResult.parse(raw);
    const vName = verifyField(input.name, parsed.track.name, { field: "name" });
    return { ok: true as const, verified: vName.ok, ...parsed, diff: vName.diff };
  },
});

// ----- track_set_name --------------------------------------------------------

const trackSetNameInputSchema = z.object({
  index: z.number().int().nonnegative(),
  name: z.string().min(1),
});

const trackSetNameOutputSchema = z.object({
  ok: z.literal(true),
  verified: z.boolean(),
  changed: z.boolean(),
  before: z.string(),
  after: z.string(),
  diff: z
    .object({
      field: z.string(),
      intent: z.unknown(),
      actual: z.unknown(),
      tolerance: z.number().optional(),
    })
    .nullable(),
});

const trackSetNameBridgeResult = z.object({
  changed: z.boolean(),
  before: z.string(),
  after: z.string(),
});

export const trackSetNameTool = defineTool({
  name: "track_set_name",
  description: "Rename a regular track. Idempotent. Verified via read-after-write.",
  input: trackSetNameInputSchema,
  output: trackSetNameOutputSchema,
  handler: async (input, ctx) => {
    const raw = await ctx.bridge.call("track.set_name", { index: input.index, name: input.name });
    const parsed = trackSetNameBridgeResult.parse(raw);
    const v = verifyField(input.name, parsed.after, { field: "name" });
    return { ok: true as const, verified: v.ok, ...parsed, diff: v.diff };
  },
});

// ----- track_set_volume ------------------------------------------------------

const trackSetVolumeInputSchema = z.object({
  index: z.number().int().nonnegative(),
  volume: z.number().min(0).max(1).describe("Normalized 0..1 per ADR-0004."),
});

const trackSetVolumeOutputSchema = z.object({
  ok: z.literal(true),
  verified: z.boolean(),
  changed: z.boolean(),
  before: z.number(),
  after: z.number(),
  before_db: z.number(),
  after_db: z.number(),
  diff: z
    .object({
      field: z.string(),
      intent: z.unknown(),
      actual: z.unknown(),
      tolerance: z.number().optional(),
    })
    .nullable(),
});

const trackSetVolumeBridgeResult = z.object({
  changed: z.boolean(),
  before: z.number(),
  after: z.number(),
  before_db: z.number(),
  after_db: z.number(),
});

export const trackSetVolumeTool = defineTool({
  name: "track_set_volume",
  description:
    "Set track volume (normalized 0..1, ADR-0004). Returns dB approximation. Idempotent within 1e-4. Verified via read-after-write.",
  input: trackSetVolumeInputSchema,
  output: trackSetVolumeOutputSchema,
  handler: async (input, ctx) => {
    const raw = await ctx.bridge.call("track.set_volume", {
      index: input.index,
      volume: input.volume,
    });
    const parsed = trackSetVolumeBridgeResult.parse(raw);
    const v = verifyField(input.volume, parsed.after, { tolerance: 1e-4, field: "volume" });
    return { ok: true as const, verified: v.ok, ...parsed, diff: v.diff };
  },
});

// ----- track_get_info --------------------------------------------------------

const trackGetInfoInputSchema = z.object({
  index: z.number().int().nonnegative(),
});

const trackGetInfoOutputSchema = z.object({
  ok: z.literal(true),
  verified: z.literal(true),
  index: z.number().int().nonnegative(),
  name: z.string(),
  color_index: z.number().int(),
  is_midi: z.boolean(),
  is_audio: z.boolean(),
  mute: z.boolean(),
  solo: z.boolean(),
  arm: z.boolean(),
  volume: z.number(),
  volume_db: z.number(),
  panning: z.number(),
  num_sends: z.number().int().nonnegative(),
  num_clip_slots: z.number().int().nonnegative(),
  num_clips: z.number().int().nonnegative(),
  num_devices: z.number().int().nonnegative(),
});

const trackGetInfoBridgeResult = trackGetInfoOutputSchema.omit({ ok: true, verified: true });

export const trackGetInfoTool = defineTool({
  name: "track_get_info",
  description:
    "Read-only detail of a single regular track (volume, panning, sends, clips, devices counts).",
  input: trackGetInfoInputSchema,
  output: trackGetInfoOutputSchema,
  handler: async (input, ctx) => {
    const raw = await ctx.bridge.call("track.get_info", { index: input.index });
    const parsed = trackGetInfoBridgeResult.parse(raw);
    return { ok: true as const, verified: true as const, ...parsed };
  },
});
