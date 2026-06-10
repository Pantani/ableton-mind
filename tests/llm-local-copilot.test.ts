import { describe, expect, it, vi } from "vitest";

import { applyChatFlagOverrides, isLocalOllama, parseChatArgs } from "../src/cli/chat.js";
import { ChatAccumulator } from "../src/llm/client.js";
import { DEFAULT_CHAT_PORT, loadLlmConfig } from "../src/llm/config.js";
import { dispatchTool, resolveTools, toOpenAITools } from "../src/llm/tools.js";
import type { BridgeClient } from "../src/server/context.js";
import { createToolContext } from "../src/server/context.js";

function bridge(call: BridgeClient["call"]): BridgeClient {
  return { call };
}

describe("local LLM config", () => {
  it("defaults to safe local Ollama on a non-tdmcp chat port", () => {
    const config = loadLlmConfig({});
    expect(config.llmBaseUrl).toBe("http://127.0.0.1:11434/v1");
    expect(config.llmModel).toBe("qwen2.5:3b");
    expect(config.llmTier).toBe("safe");
    expect(config.chatPort).toBe(DEFAULT_CHAT_PORT);
  });

  it("honors ABLETON_MIND_LLM_* env vars", () => {
    const config = loadLlmConfig({
      ABLETON_MIND_LLM_BASE_URL: "http://localhost:1234/v1",
      ABLETON_MIND_LLM_MODEL: "local-model",
      ABLETON_MIND_LLM_TIER: "creative",
      ABLETON_MIND_LLM_MAX_STEPS: "12",
      ABLETON_MIND_LLM_TEMPERATURE: "0.8",
      ABLETON_MIND_CHAT_PORT: "4242",
    });
    expect(config).toMatchObject({
      llmBaseUrl: "http://localhost:1234/v1",
      llmModel: "local-model",
      llmTier: "creative",
      llmMaxSteps: 12,
      llmTemperature: 0.8,
      chatPort: 4242,
    });
  });
});

describe("chat CLI parsing", () => {
  it("uses explicit flags to unlock write or creative tiers", () => {
    const base = loadLlmConfig({});
    expect(applyChatFlagOverrides(base, parseChatArgs([])).llmTier).toBe("safe");
    expect(applyChatFlagOverrides(base, parseChatArgs(["--write"])).llmTier).toBe("standard");
    expect(applyChatFlagOverrides(base, parseChatArgs(["--creative"])).llmTier).toBe("creative");
    expect(applyChatFlagOverrides(base, parseChatArgs(["--creative", "--read-only"])).llmTier).toBe(
      "safe",
    );
  });

  it("detects only the local Ollama default for auto-start", () => {
    expect(isLocalOllama("http://127.0.0.1:11434/v1")).toBe(true);
    expect(isLocalOllama("http://localhost:11434/v1")).toBe(true);
    expect(isLocalOllama("http://localhost:1234/v1")).toBe(false);
  });
});

describe("LLM tool tiers", () => {
  it("safe is read-only and standard excludes creative-only tools", () => {
    expect(resolveTools("safe").every((tool) => !tool.mutates)).toBe(true);
    expect(resolveTools("standard").some((tool) => tool.name === "play")).toBe(true);
    expect(resolveTools("standard").some((tool) => tool.name === "apply_recipe")).toBe(false);
    expect(resolveTools("creative").some((tool) => tool.name === "apply_recipe")).toBe(true);
  });

  it("exports OpenAI-compatible tool descriptors", () => {
    const tools = toOpenAITools(resolveTools("safe"));
    expect(tools.length).toBeGreaterThan(5);
    expect(tools[0]).toMatchObject({ type: "function" });
    expect(tools[0].function.parameters).toHaveProperty("type", "object");
  });

  it("advertises the device parameter locator requirement", () => {
    const tool = toOpenAITools(resolveTools("standard")).find(
      (candidate) => candidate.function.name === "device_set_parameter",
    );

    expect(tool?.function.parameters).toMatchObject({
      anyOf: [{ required: ["parameter_index"] }, { required: ["parameter_name"] }],
    });
  });

  it("validates args and dispatches to the underlying tool", async () => {
    const call = vi.fn(async (method: string) => {
      expect(method).toBe("session.get_info");
      return {
        name: "Test Set",
        num_tracks: 1,
        num_return_tracks: 0,
        has_master: true,
        tempo: 128,
        time_signature: { numerator: 4, denominator: 4 },
        is_playing: false,
        song_time: 0,
        song_length: 64,
        root_note: 0,
        scale_name: "Major",
      };
    });
    const ctx = createToolContext(bridge(call as BridgeClient["call"]));
    const outcome = await dispatchTool(ctx, "session_get_info", "{}", resolveTools("safe"));
    expect(outcome.ok).toBe(true);
    expect(outcome.payload).toContain("Test Set");
  });

  it("returns structured errors for bad tool arguments", async () => {
    const ctx = createToolContext(bridge(async () => ({})));
    const outcome = await dispatchTool(ctx, "track_get_info", "{", resolveTools("safe"));
    expect(outcome.ok).toBe(false);
    expect(outcome.summary).toMatch(/bad JSON/);
  });
});

describe("ChatAccumulator", () => {
  it("accumulates streamed text and tool call deltas", () => {
    const tokens: string[] = [];
    const acc = new ChatAccumulator((token) => tokens.push(token));
    acc.push({ choices: [{ delta: { content: "hi " } }] });
    acc.push({
      choices: [
        {
          delta: {
            tool_calls: [
              {
                index: 0,
                id: "call_1",
                type: "function",
                function: { name: "session_get_info", arguments: "{" },
              },
            ],
          },
        },
      ],
    });
    acc.push({
      choices: [
        {
          delta: { tool_calls: [{ index: 0, function: { arguments: "}" } }] },
        },
      ],
    });
    const message = acc.finish();
    expect(tokens).toEqual(["hi "]);
    expect(message.content).toBe("hi ");
    expect(message.tool_calls?.[0].function).toEqual({
      name: "session_get_info",
      arguments: "{}",
    });
  });
});
