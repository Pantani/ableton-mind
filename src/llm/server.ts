import { type IncomingMessage, type ServerResponse, createServer } from "node:http";

import type { ToolContext } from "../server/context.js";
import { runAgentTurn } from "./agent.js";
import { type ChatMessage, LlmClient, type LlmConfig, applySettings } from "./client.js";
import {
  DEFAULT_LLM_MAX_STEPS,
  DEFAULT_LLM_TEMPERATURE,
  type LlmRuntimeConfig,
  type LlmTier,
} from "./config.js";
import { resolveTools } from "./tools.js";
import { CHAT_HTML } from "./ui.js";

export interface ChatServerHandle {
  url: string;
  port: number;
  close: () => Promise<void>;
}

type ToolTier = LlmTier;

type ChatServerConfig = LlmRuntimeConfig & {
  llmLockedTier?: ToolTier;
};

const SSE_HEADERS = {
  "content-type": "text/event-stream",
  "cache-control": "no-cache",
  connection: "keep-alive",
} as const;

const LOOPBACK_HOSTS = new Set(["127.0.0.1", "localhost", "::1"]);

function hostnameOf(value: string | undefined): string | undefined {
  if (!value) return undefined;
  if (value.includes("://")) {
    try {
      return new URL(value).hostname;
    } catch {
      return undefined;
    }
  }
  let h = value.trim();
  if (h.startsWith("[")) {
    const end = h.indexOf("]");
    return end > 0 ? h.slice(1, end) : undefined;
  }
  const colon = h.indexOf(":");
  if (colon > 0 && colon === h.lastIndexOf(":")) h = h.slice(0, colon);
  return h;
}

export function isLoopbackRequest(req: IncomingMessage): boolean {
  const host = hostnameOf(req.headers.host);
  if (!host || !LOOPBACK_HOSTS.has(host)) return false;
  const origin = req.headers.origin;
  if (origin !== undefined) {
    const originHost = hostnameOf(origin);
    if (!originHost || !LOOPBACK_HOSTS.has(originHost)) return false;
  }
  return true;
}

function readJsonBody(req: IncomingMessage, limitBytes = 5_000_000): Promise<unknown> {
  return new Promise((resolve, reject) => {
    let size = 0;
    const chunks: Buffer[] = [];
    req.on("data", (chunk: Buffer) => {
      size += chunk.length;
      if (size > limitBytes) {
        reject(new Error("request body too large"));
        req.destroy();
        return;
      }
      chunks.push(chunk);
    });
    req.on("end", () => {
      try {
        resolve(JSON.parse(Buffer.concat(chunks).toString("utf8") || "{}"));
      } catch (err) {
        reject(err);
      }
    });
    req.on("error", reject);
  });
}

function sseWriter(res: ServerResponse): (data: unknown) => void {
  return (data: unknown) => {
    if (!res.writableEnded) res.write(`data: ${JSON.stringify(data)}\n\n`);
  };
}

export function resolveRequestedTier(
  requested: unknown,
  fallback: LlmTier,
  locked?: ToolTier,
): ToolTier {
  if (locked) return locked;
  if (requested === "safe" || requested === "standard" || requested === "creative") {
    return requested;
  }
  return fallback;
}

async function handleChat(
  req: IncomingMessage,
  res: ServerResponse,
  ctx: ToolContext,
  client: LlmClient,
  config: Pick<ChatServerConfig, "llmTier" | "llmMaxSteps" | "llmLockedTier">,
): Promise<void> {
  const body = (await readJsonBody(req)) as { messages?: ChatMessage[]; tier?: string };
  const history = Array.isArray(body.messages) ? body.messages : [];
  const tier = resolveRequestedTier(body.tier, config.llmTier, config.llmLockedTier);

  const controller = new AbortController();
  req.on("close", () => controller.abort());

  res.writeHead(200, SSE_HEADERS);
  const sse = sseWriter(res);
  const messages = await runAgentTurn(ctx, client, history, sse, {
    signal: controller.signal,
    tools: resolveTools(tier),
    maxSteps: config.llmMaxSteps ?? DEFAULT_LLM_MAX_STEPS,
  });
  if (!controller.signal.aborted) sse({ type: "final", messages });
  if (!res.writableEnded) res.end();
}

async function handlePull(
  req: IncomingMessage,
  res: ServerResponse,
  client: LlmClient,
): Promise<void> {
  const controller = new AbortController();
  req.on("close", () => controller.abort());

  res.writeHead(200, SSE_HEADERS);
  const sse = sseWriter(res);
  try {
    await client.pull((p) => sse({ type: "progress", ...p }), controller.signal);
    sse({ type: "done" });
  } catch (err) {
    if (!(err instanceof Error && err.name === "AbortError")) {
      sse({ type: "error", message: err instanceof Error ? err.message : String(err) });
    }
  }
  if (!res.writableEnded) res.end();
}

export function startChatServer(
  ctx: ToolContext,
  config: ChatServerConfig,
): Promise<ChatServerHandle> {
  let settings: LlmConfig = {
    llmBaseUrl: config.llmBaseUrl,
    llmModel: config.llmModel,
    llmApiKey: config.llmApiKey,
    llmTemperature: config.llmTemperature,
  };
  const clientFor = () => new LlmClient(settings);

  const server = createServer((req, res) => {
    const method = req.method ?? "GET";
    const path = (req.url ?? "/").split("?")[0];

    const run = async () => {
      if (!isLoopbackRequest(req)) {
        res.writeHead(403, { "content-type": "text/plain" });
        res.end("forbidden: cross-origin or non-loopback request rejected");
        return;
      }
      if (method === "GET" && path === "/") {
        res.writeHead(200, { "content-type": "text/html; charset=utf-8" });
        res.end(CHAT_HTML);
        return;
      }
      if (method === "GET" && path === "/health") {
        const health = await clientFor().health();
        res.writeHead(200, { "content-type": "application/json" });
        res.end(
          JSON.stringify({
            ...health,
            model: settings.llmModel,
            baseUrl: settings.llmBaseUrl,
            hasKey: Boolean(settings.llmApiKey),
            defaultTier: config.llmTier,
            lockedTier: config.llmLockedTier,
            maxSteps: config.llmMaxSteps,
            temperature: settings.llmTemperature ?? DEFAULT_LLM_TEMPERATURE,
          }),
        );
        return;
      }
      if (method === "GET" && path === "/models") {
        const models = await clientFor().listModels();
        res.writeHead(200, { "content-type": "application/json" });
        res.end(JSON.stringify({ models }));
        return;
      }
      if (method === "POST" && path === "/settings") {
        const patch = (await readJsonBody(req)) as {
          model?: string;
          baseUrl?: string;
          apiKey?: string;
        };
        settings = applySettings(settings, patch);
        res.writeHead(200, { "content-type": "application/json" });
        res.end(
          JSON.stringify({
            ok: true,
            model: settings.llmModel,
            baseUrl: settings.llmBaseUrl,
            hasKey: Boolean(settings.llmApiKey),
          }),
        );
        return;
      }
      if (method === "POST" && path === "/chat") {
        await handleChat(req, res, ctx, clientFor(), config);
        return;
      }
      if (method === "POST" && path === "/pull") {
        await handlePull(req, res, clientFor());
        return;
      }
      res.writeHead(404, { "content-type": "text/plain" });
      res.end("not found");
    };

    run().catch((err) => {
      const message = err instanceof Error ? err.message : String(err);
      if (!res.headersSent) res.writeHead(500, { "content-type": "text/plain" });
      if (!res.writableEnded) res.end(`error: ${message}`);
    });
  });

  return new Promise((resolve) => {
    server.listen(config.chatPort, "127.0.0.1", () => {
      const url = `http://127.0.0.1:${config.chatPort}/`;
      resolve({
        url,
        port: config.chatPort,
        close: () => new Promise<void>((done) => server.close(() => done())),
      });
    });
  });
}
