import { DEFAULT_LLM_TEMPERATURE, type LlmRuntimeConfig } from "./config.js";

export interface ChatMessage {
  role: "system" | "user" | "assistant" | "tool";
  content: string | null;
  tool_calls?: ToolCall[];
  tool_call_id?: string;
  name?: string;
}

export interface ToolCall {
  id: string;
  type: "function";
  function: { name: string; arguments: string };
}

export interface OpenAITool {
  type: "function";
  function: { name: string; description: string; parameters: unknown };
}

export interface StreamOptions {
  signal?: AbortSignal;
  onToken?: (token: string) => void;
}

export interface LlmConfig {
  llmBaseUrl: string;
  llmModel: string;
  llmApiKey?: string;
  llmTemperature?: number;
}

export interface SettingsPatch {
  model?: string;
  baseUrl?: string;
  apiKey?: string;
}

export interface PullProgress {
  status: string;
  total?: number;
  completed?: number;
}

interface StreamChunk {
  choices?: Array<{
    delta?: {
      content?: string | null;
      tool_calls?: Array<{
        index?: number;
        id?: string;
        type?: "function";
        function?: { name?: string; arguments?: string };
      }>;
    };
  }>;
}

export function applySettings(current: LlmConfig, patch: SettingsPatch): LlmConfig {
  const next: LlmConfig = { ...current };
  if (patch.model?.trim()) next.llmModel = patch.model.trim();
  if (patch.baseUrl?.trim()) next.llmBaseUrl = patch.baseUrl.trim();
  if (patch.apiKey !== undefined) {
    const key = patch.apiKey.trim();
    if (key) next.llmApiKey = key;
    else next.llmApiKey = undefined;
  }
  return next;
}

export class ChatAccumulator {
  content = "";
  private readonly calls: Array<{ id: string; name: string; args: string }> = [];

  constructor(private readonly onToken?: (token: string) => void) {}

  push(chunk: StreamChunk): void {
    const delta = chunk.choices?.[0]?.delta;
    if (!delta) return;
    if (typeof delta.content === "string" && delta.content.length > 0) {
      this.content += delta.content;
      this.onToken?.(delta.content);
    }
    for (const part of delta.tool_calls ?? []) {
      const idx = part.index ?? 0;
      let slot = this.calls[idx];
      if (!slot) {
        slot = { id: "", name: "", args: "" };
        this.calls[idx] = slot;
      }
      if (part.id) slot.id = part.id;
      if (part.function?.name) slot.name = part.function.name;
      if (part.function?.arguments) slot.args += part.function.arguments;
    }
  }

  finish(): ChatMessage {
    const toolCalls = this.calls
      .filter((c) => c.name.length > 0)
      .map((c) => ({
        id: c.id || `call_${c.name}`,
        type: "function" as const,
        function: { name: c.name, arguments: c.args },
      }));
    return {
      role: "assistant",
      content: this.content || null,
      ...(toolCalls.length > 0 ? { tool_calls: toolCalls } : {}),
    };
  }
}

async function readLines(stream: ReadableStream<Uint8Array>, onLine: (line: string) => void) {
  const reader = stream.getReader();
  const decoder = new TextDecoder();
  let buf = "";
  while (true) {
    const { done, value } = await reader.read();
    if (done) break;
    buf += decoder.decode(value, { stream: true });
    let nl = buf.indexOf("\n");
    while (nl >= 0) {
      const line = buf.slice(0, nl).trim();
      buf = buf.slice(nl + 1);
      if (line) onLine(line);
      nl = buf.indexOf("\n");
    }
  }
  const tail = buf.trim();
  if (tail) onLine(tail);
}

export class LlmClient {
  constructor(private readonly cfg: LlmConfig) {}

  static fromRuntime(config: LlmRuntimeConfig): LlmClient {
    return new LlmClient(config);
  }

  private headers(): Record<string, string> {
    const h: Record<string, string> = { "content-type": "application/json" };
    if (this.cfg.llmApiKey) h.authorization = `Bearer ${this.cfg.llmApiKey}`;
    return h;
  }

  private nativeRoot(): string {
    return this.cfg.llmBaseUrl.replace(/\/v1\/?$/, "");
  }

  async health(): Promise<{ ok: boolean; modelReady: boolean; detail: string }> {
    try {
      const res = await fetch(`${this.cfg.llmBaseUrl}/models`, { headers: this.headers() });
      if (!res.ok) {
        return { ok: false, modelReady: false, detail: `endpoint returned HTTP ${res.status}` };
      }
      const data = (await res.json()) as { data?: Array<{ id: string }> };
      const models = (data.data ?? []).map((m) => m.id);
      const modelReady = models.includes(this.cfg.llmModel);
      return {
        ok: true,
        modelReady,
        detail: modelReady
          ? `model '${this.cfg.llmModel}' is ready`
          : `model '${this.cfg.llmModel}' is not pulled (available: ${models.join(", ") || "none"})`,
      };
    } catch (err) {
      return { ok: false, modelReady: false, detail: (err as Error).message };
    }
  }

  async listModels(): Promise<string[]> {
    try {
      const res = await fetch(`${this.cfg.llmBaseUrl}/models`, { headers: this.headers() });
      if (!res.ok) return [];
      const data = (await res.json()) as { data?: Array<{ id: string }> };
      return (data.data ?? []).map((m) => m.id);
    } catch {
      return [];
    }
  }

  async chatStream(
    messages: ChatMessage[],
    tools: OpenAITool[],
    opts: StreamOptions = {},
  ): Promise<ChatMessage> {
    const res = await fetch(`${this.cfg.llmBaseUrl}/chat/completions`, {
      method: "POST",
      headers: this.headers(),
      body: JSON.stringify({
        model: this.cfg.llmModel,
        messages,
        tools,
        tool_choice: "auto",
        temperature: this.cfg.llmTemperature ?? DEFAULT_LLM_TEMPERATURE,
        stream: true,
      }),
      signal: opts.signal,
    });
    if (!res.ok) {
      const body = await res.text();
      throw new Error(`LLM endpoint returned HTTP ${res.status}: ${body.slice(0, 300)}`);
    }
    if (!res.body) throw new Error("LLM endpoint returned no response body");

    const acc = new ChatAccumulator(opts.onToken);
    await readLines(res.body, (line) => {
      if (!line.startsWith("data:")) return;
      const data = line.slice(5).trim();
      if (data === "[DONE]") return;
      try {
        acc.push(JSON.parse(data) as StreamChunk);
      } catch {
        // Ignore keep-alive or malformed SSE chunks from local backends.
      }
    });
    return acc.finish();
  }

  async pull(onProgress: (p: PullProgress) => void, signal?: AbortSignal): Promise<void> {
    const res = await fetch(`${this.nativeRoot()}/api/pull`, {
      method: "POST",
      headers: this.headers(),
      body: JSON.stringify({ name: this.cfg.llmModel, stream: true }),
      signal,
    });
    if (!res.ok) {
      throw new Error(`pull failed (HTTP ${res.status}) — auto-pull needs local Ollama`);
    }
    if (!res.body) return;
    await readLines(res.body, (line) => {
      try {
        onProgress(JSON.parse(line) as PullProgress);
      } catch {
        // Ignore non-JSON progress lines.
      }
    });
  }
}
