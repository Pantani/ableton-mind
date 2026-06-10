import { allPrompts } from "../prompts/index.js";
import type { ToolContext } from "../server/context.js";
import type { ChatMessage, LlmClient } from "./client.js";
import { DEFAULT_LLM_MAX_STEPS, type LlmTier, MAX_LLM_MAX_STEPS } from "./config.js";
import { type LlmTool, dispatchTool, resolveTools, toOpenAITools } from "./tools.js";

export type AgentEvent =
  | { type: "token"; text: string }
  | { type: "tool"; name: string; status: "start"; args: string }
  | { type: "tool"; name: string; status: "done"; ok: boolean; summary: string }
  | { type: "answer"; content: string }
  | { type: "error"; message: string };

export interface RunOptions {
  signal?: AbortSignal;
  tools?: LlmTool[];
  tier?: LlmTier;
  maxSteps?: number;
}

const BASE_PROMPT = `You are the ableton-mind local copilot: a small, fast model running locally and connected to Ableton Live through the ableton-mind bridge.

You handle simple production and session-control tasks:
- inspect the Live set before changing it,
- control transport and tempo,
- create or update individual tracks and clips,
- add MIDI notes, rename clips/tracks, and adjust simple mixer/device parameters,
- use the embedded knowledge, recipe and prompt catalogs when they help.

Rules:
- Use tools. Do not invent track indexes, clip slots, device indexes or parameter names.
- Read before write: call session_get_info, track_list, track_get_info or device_get_parameters when unsure.
- Keep changes focused and report plainly what changed.
- If the user asks for a full arrangement, complex mix, live rig or long multi-track production, prefer a recipe in creative mode, or explain that Claude/Codex with the full MCP surface should handle it.
- Reply in the user's language.`;

const READ_ONLY_NOTE = `
- READ-ONLY MODE is on: inspect freely, but do not mutate Live. If the user asks for a change, explain what you would do and suggest standard/creative mode or a handoff to Claude/Codex.`;

const CREATIVE_NOTE = `
- CREATIVE MODE is on: you may load browser items and apply embedded recipes. Still inspect first, keep operations small, and verify with session_snapshot/session_diff or render_preview.`;

function promptCatalogNote(): string {
  if (allPrompts.length === 0) return "";
  const lines = allPrompts.slice(0, 30).map((prompt) => `- ${prompt.name}: ${prompt.description}`);
  return `\n\nRegistered MCP prompts:\n${lines.join("\n")}\n\nYou cannot invoke MCP prompts directly from this local chat, but you can tell the user which prompt fits.`;
}

function systemPrompt(readOnly: boolean, creative: boolean): string {
  const prompt = BASE_PROMPT + promptCatalogNote();
  if (readOnly) return prompt + READ_ONLY_NOTE;
  return creative ? prompt + CREATIVE_NOTE : prompt;
}

function ensureSystem(history: ChatMessage[], readOnly: boolean, creative: boolean): ChatMessage[] {
  const rest = history.filter((m) => m.role !== "system");
  return [{ role: "system", content: systemPrompt(readOnly, creative) }, ...rest];
}

function isAbort(err: unknown): boolean {
  return err instanceof Error && (err.name === "AbortError" || err.message === "cancelled");
}

export async function runAgentTurn(
  ctx: ToolContext,
  client: LlmClient,
  history: ChatMessage[],
  emit: (event: AgentEvent) => void,
  opts: RunOptions = {},
): Promise<ChatMessage[]> {
  const toolset = opts.tools ?? resolveTools(opts.tier ?? "standard");
  const readOnly = !toolset.some((tool) => tool.mutates);
  const creative = toolset.some((tool) => tool.creativeOnly);
  const messages = ensureSystem(history, readOnly, creative);
  const tools = toOpenAITools(toolset);
  const maxSteps =
    opts.maxSteps !== undefined && Number.isFinite(opts.maxSteps)
      ? Math.min(MAX_LLM_MAX_STEPS, Math.max(1, Math.trunc(opts.maxSteps)))
      : DEFAULT_LLM_MAX_STEPS;

  for (let step = 0; step < maxSteps; step++) {
    if (opts.signal?.aborted) {
      emit({ type: "error", message: "cancelled" });
      return messages;
    }

    let assistant: ChatMessage;
    try {
      assistant = await client.chatStream(messages, tools, {
        signal: opts.signal,
        onToken: (text) => emit({ type: "token", text }),
      });
    } catch (err) {
      if (isAbort(err)) {
        emit({ type: "error", message: "cancelled" });
        return messages;
      }
      const message = (err as Error).message;
      emit({ type: "error", message });
      messages.push({ role: "assistant", content: `(failed to reach the LLM: ${message})` });
      return messages;
    }

    messages.push(assistant);
    const calls = assistant.tool_calls ?? [];
    if (calls.length === 0) {
      emit({ type: "answer", content: assistant.content ?? "" });
      return messages;
    }

    for (const call of calls) {
      emit({
        type: "tool",
        name: call.function.name,
        status: "start",
        args: call.function.arguments,
      });
      const outcome = await dispatchTool(ctx, call.function.name, call.function.arguments, toolset);
      emit({
        type: "tool",
        name: call.function.name,
        status: "done",
        ok: outcome.ok,
        summary: outcome.summary,
      });
      messages.push({
        role: "tool",
        tool_call_id: call.id,
        name: call.function.name,
        content: outcome.payload,
      });
    }
  }

  const content =
    "(stopped after the maximum number of tool steps. Try a smaller request, use a recipe, or hand this to Claude/Codex.)";
  emit({ type: "answer", content });
  messages.push({ role: "assistant", content });
  return messages;
}
