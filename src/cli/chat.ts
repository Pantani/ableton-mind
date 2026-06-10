import { spawn, spawnSync } from "node:child_process";
import { setTimeout as delay } from "node:timers/promises";
import { parseArgs } from "node:util";

import { TcpJsonRpcClient, performHandshake } from "../live-client/index.js";
import { runAgentTurn } from "../llm/agent.js";
import { LlmClient } from "../llm/client.js";
import {
  DEFAULT_LLM_TEMPERATURE,
  type LlmRuntimeConfig,
  type LlmTier,
  loadLlmConfig,
} from "../llm/config.js";
import { startChatServer } from "../llm/server.js";
import { resolveTools } from "../llm/tools.js";
import type { BridgeClient } from "../server/context.js";
import { type ToolContext, createBridgeClient, createToolContext } from "../server/context.js";
import { logger } from "../utils/logger.js";

function openBrowser(url: string): void {
  const [cmd, args] =
    process.platform === "darwin"
      ? ["open", [url]]
      : process.platform === "win32"
        ? ["cmd", ["/c", "start", "", url]]
        : ["xdg-open", [url]];
  try {
    spawn(cmd, args, { stdio: "ignore", detached: true }).unref();
  } catch {
    // Best effort only; the URL is printed regardless.
  }
}

function ollamaOnPath(): boolean {
  const probe = process.platform === "win32" ? "where" : "which";
  return spawnSync(probe, ["ollama"], { stdio: "ignore" }).status === 0;
}

export function isLocalOllama(baseUrl: string): boolean {
  return /(?:127\.0\.0\.1|localhost|0\.0\.0\.0):11434\b/.test(baseUrl);
}

async function ensureOllamaUp(
  client: LlmClient,
  baseUrl: string,
  autoStart: boolean,
  log: (msg: string) => void,
): Promise<boolean> {
  if ((await client.health()).ok) return true;
  if (!autoStart || !isLocalOllama(baseUrl)) return false;
  if (!ollamaOnPath()) {
    log("  Ollama is not installed. Install it from https://ollama.com or pass --no-ollama.");
    return false;
  }
  log("  Ollama is not running; starting it in the background...");
  const child = spawn("ollama", ["serve"], { stdio: "ignore", detached: true });
  child.on("error", () => {
    // Reported by the health poll below.
  });
  child.unref();
  for (let i = 0; i < 30; i++) {
    await delay(500);
    if ((await client.health()).ok) {
      log("  Ollama is up.");
      return true;
    }
  }
  log("  Ollama did not respond in time. Start it manually with `ollama serve`.");
  return false;
}

export interface ChatCliOptions {
  help: boolean;
  openBrowser: boolean;
  autoStartOllama: boolean;
  readOnly: boolean;
  write: boolean;
  creative: boolean;
  prompt?: string;
  model?: string;
  baseUrl?: string;
  port?: number;
}

interface ChatRuntimeDeps {
  loadConfig?: typeof loadLlmConfig;
  createClient?: (config: LlmRuntimeConfig) => LlmClient;
  startChatServer?: typeof startChatServer;
  openBrowser?: (url: string) => void;
  ensureOllamaUp?: typeof ensureOllamaUp;
  writeStdout?: (chunk: string) => void;
  writeStderr?: (chunk: string) => void;
  createContext?: () => Promise<{ ctx: ToolContext; close: () => Promise<void>; detail: string }>;
}

const HELP = `ableton-mind chat - local LLM copilot in your browser (alias: ableton-mind llm-run)

Usage: ableton-mind chat [flags]

Flags:
  --read-only       Lock the copilot to inspection-only tools.
  --write           Start in standard mode: inspection + simple Live mutations.
  --creative        Start in creative mode: standard tools + browser load / recipes.
  --prompt <text>   Run one headless prompt and print the answer.
  --model <name>    Override ABLETON_MIND_LLM_MODEL for this run.
  --base-url <url>  Override ABLETON_MIND_LLM_BASE_URL for this run.
  --port <number>   Override ABLETON_MIND_CHAT_PORT for this run.
  --no-ollama       Do not auto-start local Ollama.
  --no-open         Do not open the browser automatically.
  -h, --help        Show this help.

Default tier is safe. Use --write or --creative when you want the local model to change Live.`;

export function parseChatArgs(argv: string[] = []): ChatCliOptions {
  const { values } = parseArgs({
    args: argv,
    allowPositionals: false,
    options: {
      help: { type: "boolean", short: "h", default: false },
      "no-open": { type: "boolean", default: false },
      "no-ollama": { type: "boolean", default: false },
      "read-only": { type: "boolean", default: false },
      write: { type: "boolean", default: false },
      creative: { type: "boolean", default: false },
      prompt: { type: "string" },
      model: { type: "string" },
      "base-url": { type: "string" },
      port: { type: "string" },
    },
  });

  const port = typeof values.port === "string" ? Number(values.port) : undefined;
  return {
    help: values.help === true,
    openBrowser: values["no-open"] !== true,
    autoStartOllama: values["no-ollama"] !== true,
    readOnly: values["read-only"] === true,
    write: values.write === true,
    creative: values.creative === true,
    ...(typeof values.prompt === "string" ? { prompt: values.prompt } : {}),
    ...(typeof values.model === "string" ? { model: values.model } : {}),
    ...(typeof values["base-url"] === "string" ? { baseUrl: values["base-url"] } : {}),
    ...(Number.isFinite(port) && port !== undefined ? { port } : {}),
  };
}

export function applyChatFlagOverrides(
  config: LlmRuntimeConfig,
  opts: Pick<ChatCliOptions, "readOnly" | "write" | "creative" | "model" | "baseUrl" | "port">,
): LlmRuntimeConfig {
  const next: LlmRuntimeConfig = { ...config };
  if (opts.model?.trim()) next.llmModel = opts.model.trim();
  if (opts.baseUrl?.trim()) next.llmBaseUrl = opts.baseUrl.trim();
  if (opts.port !== undefined) next.chatPort = opts.port;
  if (opts.readOnly) next.llmTier = "safe";
  else if (opts.creative) next.llmTier = "creative";
  else if (opts.write) next.llmTier = "standard";
  return next;
}

async function createChatContext(): Promise<{
  ctx: ToolContext;
  close: () => Promise<void>;
  detail: string;
}> {
  const tcp = new TcpJsonRpcClient({ autoReconnect: false });
  try {
    await tcp.connect();
    await performHandshake(tcp);
    return {
      ctx: createToolContext(createBridgeClient(tcp)),
      close: () => tcp.close(),
      detail: "Ableton bridge connected",
    };
  } catch (err) {
    const message = (err as Error).message;
    const offlineBridge: BridgeClient = {
      call: async () => {
        throw new Error(`Ableton bridge offline: ${message}`);
      },
    };
    return {
      ctx: createToolContext(offlineBridge),
      close: async () => {},
      detail: `Ableton bridge offline: ${message}`,
    };
  }
}

export async function runHeadlessPrompt(
  ctx: ToolContext,
  client: LlmClient,
  prompt: string,
  config: Pick<LlmRuntimeConfig, "llmTier" | "llmMaxSteps">,
  writeStdout: (chunk: string) => void,
): Promise<string> {
  let answer: string | undefined;
  let error: string | undefined;
  const messages = await runAgentTurn(
    ctx,
    client,
    [{ role: "user", content: prompt }],
    (event) => {
      if (event.type === "answer") answer = event.content;
      if (event.type === "error") error = event.message;
    },
    { tools: resolveTools(config.llmTier), maxSteps: config.llmMaxSteps },
  );
  const fallback = [...messages]
    .reverse()
    .find(
      (message) => message.role === "assistant" && typeof message.content === "string",
    )?.content;
  const output = (answer ?? fallback ?? (error ? `Error: ${error}` : "")).trimEnd();
  if (output) writeStdout(`${output}\n`);
  return output;
}

export async function runChat(argv: string[] = [], deps: ChatRuntimeDeps = {}): Promise<void> {
  const writeStdout = deps.writeStdout ?? ((chunk: string) => process.stdout.write(chunk));
  const writeStderr = deps.writeStderr ?? ((chunk: string) => process.stderr.write(chunk));
  let opts: ChatCliOptions;
  try {
    opts = parseChatArgs(argv);
  } catch (err) {
    writeStderr(`ableton-mind chat: ${(err as Error).message}\n\n${HELP}\n`);
    process.exitCode = 1;
    return;
  }
  if (opts.help) {
    writeStdout(`${HELP}\n`);
    return;
  }

  const load = deps.loadConfig ?? loadLlmConfig;
  const makeClient =
    deps.createClient ?? ((config: LlmRuntimeConfig) => LlmClient.fromRuntime(config));
  const launchServer = deps.startChatServer ?? startChatServer;
  const launchBrowser = deps.openBrowser ?? openBrowser;
  const ensureOllama = deps.ensureOllamaUp ?? ensureOllamaUp;
  const makeContext = deps.createContext ?? createChatContext;

  const config = applyChatFlagOverrides(load(process.env), opts);
  const client = makeClient(config);
  const context = await makeContext();
  const headless = opts.prompt !== undefined;
  const log = (msg: string) => (headless ? writeStderr(msg) : writeStdout(msg));

  await ensureOllama(client, config.llmBaseUrl, opts.autoStartOllama, (msg) => log(`${msg}\n`));

  if (headless) {
    await runHeadlessPrompt(context.ctx, client, opts.prompt ?? "", config, writeStdout);
    await context.close();
    return;
  }

  const serverConfig = opts.readOnly ? { ...config, llmLockedTier: "safe" as LlmTier } : config;
  const handle = await launchServer(context.ctx, serverConfig);
  const health = await client.health();

  writeStdout(`\n  ableton-mind local copilot -> ${handle.url}\n`);
  writeStdout(`  model: ${config.llmModel}  |  endpoint: ${config.llmBaseUrl}\n`);
  writeStdout(
    `  tier: ${config.llmTier}  |  temperature: ${config.llmTemperature ?? DEFAULT_LLM_TEMPERATURE}\n`,
  );
  writeStdout(`  bridge: ${context.detail}\n`);
  if (!health.ok) {
    writeStdout(`  LLM endpoint unreachable: ${health.detail}\n`);
  } else if (!health.modelReady) {
    writeStdout(`  ${health.detail}\n  Pull it with: ollama pull ${config.llmModel}\n`);
  } else {
    writeStdout(`  status: ${health.detail}\n`);
  }
  writeStdout("\n  Press Ctrl-C to stop.\n\n");
  if (opts.openBrowser) launchBrowser(handle.url);

  await new Promise<void>((resolve) => {
    const stop = () => {
      process.off("SIGINT", stop);
      process.off("SIGTERM", stop);
      void handle
        .close()
        .then(() => context.close())
        .finally(() => resolve());
    };
    process.once("SIGINT", stop);
    process.once("SIGTERM", stop);
  });
}

const ASK_HELP = `ableton-mind ask - one-shot local LLM prompt

Usage: ableton-mind ask [flags] "<prompt>"

Flags mirror chat: --read-only, --write, --creative, --model, --base-url, --no-ollama.
Add --json to print {"ok":true,"answer":"...","tier":"..."}.`;

export async function runAsk(argv: string[] = [], deps: ChatRuntimeDeps = {}): Promise<void> {
  const writeStdout = deps.writeStdout ?? ((chunk: string) => process.stdout.write(chunk));
  const writeStderr = deps.writeStderr ?? ((chunk: string) => process.stderr.write(chunk));
  const { values, positionals } = parseArgs({
    args: argv,
    allowPositionals: true,
    options: {
      help: { type: "boolean", short: "h", default: false },
      json: { type: "boolean", default: false },
      "no-ollama": { type: "boolean", default: false },
      "read-only": { type: "boolean", default: false },
      write: { type: "boolean", default: false },
      creative: { type: "boolean", default: false },
      model: { type: "string" },
      "base-url": { type: "string" },
    },
  });
  if (values.help === true || positionals.length === 0) {
    writeStdout(`${ASK_HELP}\n`);
    return;
  }
  const prompt = positionals.join(" ");
  let answer = "";
  await runChat(
    [
      "--prompt",
      prompt,
      "--no-open",
      ...(values["no-ollama"] === true ? ["--no-ollama"] : []),
      ...(values["read-only"] === true ? ["--read-only"] : []),
      ...(values.write === true ? ["--write"] : []),
      ...(values.creative === true ? ["--creative"] : []),
      ...(typeof values.model === "string" ? ["--model", values.model] : []),
      ...(typeof values["base-url"] === "string" ? ["--base-url", values["base-url"]] : []),
    ],
    {
      ...deps,
      writeStdout: (chunk) => {
        answer += chunk;
        if (values.json !== true) writeStdout(chunk);
      },
      writeStderr,
    },
  );
  if (values.json === true) {
    const config = loadLlmConfig(process.env);
    writeStdout(
      `${JSON.stringify({ ok: true, answer: answer.trimEnd(), tier: config.llmTier })}\n`,
    );
  }
}

logger.debug("local LLM chat CLI loaded");
