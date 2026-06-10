import type { z } from "zod";

import type { ToolContext } from "../server/context.js";
import type { ToolDefinition } from "../server/define-tool.js";
import {
  applyRecipeTool,
  browserGetCategoriesTool,
  browserLoadItemTool,
  clipAddNotesTool,
  clipFireTool,
  clipSetEnvelopeTool,
  clipSetLoopTool,
  clipSetNameTool,
  clipStopTool,
  createMidiClipTool,
  deviceGetParametersTool,
  deviceSetParameterTool,
  listPromptsTool,
  listRecipesTool,
  listResourcesTool,
  playTool,
  renderPreviewTool,
  sceneFireTool,
  sessionDiffTool,
  sessionGetInfoTool,
  sessionSnapshotTool,
  setTempoTool,
  stopTool,
  trackGetInfoTool,
  trackListTool,
  trackSetNameTool,
  trackSetVolumeTool,
  trackUpsertTool,
} from "../tools/index.js";
import type { OpenAITool } from "./client.js";
import type { LlmTier } from "./config.js";

type JsonSchema = Record<string, unknown>;
type Runner = (ctx: ToolContext, args: unknown) => Promise<unknown>;

export interface LlmTool {
  name: string;
  description: string;
  schema: z.ZodTypeAny;
  parameters: JsonSchema;
  run: Runner;
  mutates: boolean;
  creativeOnly?: boolean;
}

const noArgs = { type: "object", properties: {}, additionalProperties: false };
const bool = (description: string): JsonSchema => ({ type: "boolean", description });
const num = (description: string, minimum?: number, maximum?: number): JsonSchema => ({
  type: "number",
  description,
  ...(minimum !== undefined ? { minimum } : {}),
  ...(maximum !== undefined ? { maximum } : {}),
});
const int = (description: string, minimum = 0, maximum?: number): JsonSchema => ({
  type: "integer",
  description,
  minimum,
  ...(maximum !== undefined ? { maximum } : {}),
});
const str = (description: string): JsonSchema => ({ type: "string", description });

function obj(properties: Record<string, JsonSchema>, required: string[] = []): JsonSchema {
  return { type: "object", properties, required, additionalProperties: false };
}

function wrap<TInput extends z.ZodTypeAny, TOutput extends z.ZodTypeAny>(
  definition: ToolDefinition<TInput, TOutput>,
  parameters: JsonSchema,
  mutates: boolean,
  creativeOnly = false,
): LlmTool {
  return {
    name: definition.name,
    description: definition.description,
    schema: definition.input as z.ZodTypeAny,
    parameters,
    mutates,
    creativeOnly,
    run: (ctx, args) => definition.handler(args as z.infer<TInput>, ctx),
  };
}

const trackIndex = int("Regular track index.");
const clipRef = obj(
  {
    track_index: int("Regular track index."),
    clip_slot_index: int("Session clip slot index."),
  },
  ["track_index", "clip_slot_index"],
);

const note = obj(
  {
    pitch: int("MIDI pitch 0..127.", 0, 127),
    start: num("Start position in beats from clip start.", 0),
    duration: num("Duration in beats.", 0),
    velocity: int("Velocity 0..127. Optional; bridge default is used when omitted.", 0, 127),
    mute: bool("Mute this note."),
  },
  ["pitch", "start", "duration"],
);

const envelopePoint = obj(
  {
    time: num("Beat position from clip start.", 0),
    value: num("Automation value for the target parameter."),
    curve_type: {
      type: "string",
      enum: ["linear", "ramp", "hold"],
      description: "Optional curve type.",
    },
  },
  ["time", "value"],
);

export const LLM_TOOLS: LlmTool[] = [
  wrap(sessionGetInfoTool, noArgs, false),
  wrap(
    trackListTool,
    obj({
      include_master: bool("Include master track."),
      include_returns: bool("Include return tracks."),
    }),
    false,
  ),
  wrap(trackGetInfoTool, obj({ index: trackIndex }, ["index"]), false),
  wrap(
    deviceGetParametersTool,
    obj({ track_index: trackIndex, device_index: int("Device index on the track.") }, [
      "track_index",
      "device_index",
    ]),
    false,
  ),
  wrap(browserGetCategoriesTool, noArgs, false),
  wrap(
    sessionSnapshotTool,
    obj({
      include_clips: bool("Include clip summaries."),
      include_devices: bool("Include device summaries."),
    }),
    false,
  ),
  wrap(
    sessionDiffTool,
    obj({ previous: { type: "object", description: "A prior session_snapshot result." } }, [
      "previous",
    ]),
    false,
  ),
  wrap(
    renderPreviewTool,
    obj({
      mode: { type: "string", enum: ["snapshot", "bounce"] },
      bars: int("Preview length in bars.", 1),
    }),
    false,
  ),
  wrap(
    listRecipesTool,
    obj({
      category: {
        type: "string",
        enum: ["drums", "bass", "chords", "racks", "arrangements", "mixing", "live_performance"],
      },
    }),
    false,
  ),
  wrap(listPromptsTool, noArgs, false),
  wrap(listResourcesTool, noArgs, false),
  wrap(
    playTool,
    obj({ from_beginning: bool("Restart from the beginning instead of continuing.") }),
    true,
  ),
  wrap(stopTool, noArgs, true),
  wrap(setTempoTool, obj({ bpm: num("Tempo in BPM.", 20, 999) }, ["bpm"]), true),
  wrap(
    trackUpsertTool,
    obj(
      {
        name: str("Track name."),
        type: { type: "string", enum: ["midi", "audio"] },
        index: int("Optional insert index."),
      },
      ["name", "type"],
    ),
    true,
  ),
  wrap(
    trackSetNameTool,
    obj({ index: trackIndex, name: str("New track name.") }, ["index", "name"]),
    true,
  ),
  wrap(
    trackSetVolumeTool,
    obj({ index: trackIndex, volume: num("Normalized volume 0..1.", 0, 1) }, ["index", "volume"]),
    true,
  ),
  wrap(
    deviceSetParameterTool,
    {
      ...obj(
        {
          track_index: trackIndex,
          device_index: int("Device index on the track."),
          parameter_index: int("Parameter index. Use either this or parameter_name."),
          parameter_name: str("Parameter name. Use this when possible."),
          value: num("Parameter value."),
        },
        ["track_index", "device_index", "value"],
      ),
      anyOf: [{ required: ["parameter_index"] }, { required: ["parameter_name"] }],
    },
    true,
  ),
  wrap(
    createMidiClipTool,
    obj(
      {
        track_index: trackIndex,
        clip_slot_index: int("Session clip slot index."),
        length_beats: num("Clip length in beats.", 0),
        name: str("Optional clip name."),
      },
      ["track_index", "clip_slot_index", "length_beats"],
    ),
    true,
  ),
  wrap(
    clipAddNotesTool,
    obj(
      {
        track_index: trackIndex,
        clip_slot_index: int("Session clip slot index."),
        notes: { type: "array", items: note, minItems: 1 },
      },
      ["track_index", "clip_slot_index", "notes"],
    ),
    true,
  ),
  wrap(clipFireTool, clipRef, true),
  wrap(clipStopTool, clipRef, true),
  wrap(
    clipSetNameTool,
    obj(
      {
        track_index: trackIndex,
        clip_slot_index: int("Session clip slot index."),
        name: str("New clip name."),
      },
      ["track_index", "clip_slot_index", "name"],
    ),
    true,
  ),
  wrap(
    clipSetLoopTool,
    obj(
      {
        track_index: trackIndex,
        clip_slot_index: int("Session clip slot index."),
        loop_start: num("Loop start in beats.", 0),
        loop_end: num("Loop end in beats.", 0),
        looping: bool("Whether looping is enabled."),
      },
      ["track_index", "clip_slot_index"],
    ),
    true,
  ),
  wrap(
    clipSetEnvelopeTool,
    obj(
      {
        track_index: trackIndex,
        clip_slot_index: int("Session clip slot index."),
        parameter_path: str("mixer.volume or device.<index>.parameter.<parameter_index>."),
        points: { type: "array", items: envelopePoint },
      },
      ["track_index", "clip_slot_index", "parameter_path", "points"],
    ),
    true,
  ),
  wrap(sceneFireTool, obj({ index: int("Scene index.") }, ["index"]), true),
  wrap(
    browserLoadItemTool,
    obj(
      {
        path: {
          type: "array",
          items: { type: "string" },
          minItems: 1,
          description: "Browser path names, starting with the root category key.",
        },
      },
      ["path"],
    ),
    true,
    true,
  ),
  wrap(
    applyRecipeTool,
    obj(
      {
        recipe_id: str("Recipe id, for example drums/tech-house-kick."),
        overrides: { type: "object", description: "Optional recipe input overrides." },
      },
      ["recipe_id"],
    ),
    true,
    true,
  ),
];

export function resolveTools(tier: LlmTier = "standard"): LlmTool[] {
  if (tier === "safe") return LLM_TOOLS.filter((tool) => !tool.mutates);
  if (tier === "creative") return LLM_TOOLS;
  return LLM_TOOLS.filter((tool) => !tool.creativeOnly);
}

export function toOpenAITools(tools: LlmTool[]): OpenAITool[] {
  return tools.map((tool) => ({
    type: "function",
    function: {
      name: tool.name,
      description: tool.description,
      parameters: tool.parameters,
    },
  }));
}

export interface ToolOutcome {
  ok: boolean;
  summary: string;
  payload: string;
}

interface PreparedToolCall {
  tool: LlmTool;
  args: unknown;
}

function parseToolArgs(name: string, rawArgs: string): ToolOutcome | { parsed: unknown } {
  try {
    return { parsed: rawArgs.trim() ? JSON.parse(rawArgs) : {} };
  } catch (err) {
    return {
      ok: false,
      summary: `bad JSON args for ${name}`,
      payload: `Error: arguments were not valid JSON: ${(err as Error).message}`,
    };
  }
}

function prepareToolCall(
  name: string,
  rawArgs: string,
  tools: LlmTool[],
): ToolOutcome | PreparedToolCall {
  const tool = tools.find((candidate) => candidate.name === name);
  if (!tool) {
    return {
      ok: false,
      summary: `unknown tool: ${name}`,
      payload: `Error: no tool named "${name}".`,
    };
  }

  const parsed = parseToolArgs(name, rawArgs);
  if ("ok" in parsed) return parsed;

  const args = tool.schema.safeParse(parsed.parsed);
  if (!args.success) {
    return {
      ok: false,
      summary: `invalid args for ${name}`,
      payload: `Error: invalid arguments: ${args.error.message}`,
    };
  }
  return { tool, args: args.data };
}

function resultOk(result: unknown): boolean {
  if (typeof result !== "object" || result === null || !("ok" in result)) return true;
  return Boolean((result as { ok?: unknown }).ok);
}

async function runPreparedTool(
  ctx: ToolContext,
  name: string,
  prepared: PreparedToolCall,
): Promise<ToolOutcome> {
  try {
    const result = await prepared.tool.run(ctx, prepared.args);
    const ok = resultOk(result);
    return {
      ok,
      summary: `${name}: ${ok ? "ok" : "failed"}`,
      payload: JSON.stringify(result, null, 2),
    };
  } catch (err) {
    return {
      ok: false,
      summary: `${name}: failed`,
      payload: `Error: ${(err as Error).message}`,
    };
  }
}

export async function dispatchTool(
  ctx: ToolContext,
  name: string,
  rawArgs: string,
  tools: LlmTool[] = LLM_TOOLS,
): Promise<ToolOutcome> {
  const prepared = prepareToolCall(name, rawArgs, tools);
  if ("ok" in prepared) return prepared;
  return runPreparedTool(ctx, name, prepared);
}
