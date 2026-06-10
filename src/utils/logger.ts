/**
 * Logger that writes EXCLUSIVELY to stderr.
 *
 * The MCP server uses the stdio transport: stdout is the sacred MCP protocol channel.
 * Any write to stdout that isn't a valid MCP message breaks the client.
 * Therefore all production, debug, warn, error logs go to stderr.
 *
 * Levels: debug < info < warn < error.
 * Default: info. Override via env `ABLETON_MIND_LOG_LEVEL`.
 */

export type LogLevel = "debug" | "info" | "warn" | "error";

const LEVEL_WEIGHT: Record<LogLevel, number> = {
  debug: 10,
  info: 20,
  warn: 30,
  error: 40,
};

function resolveLevel(): LogLevel {
  const raw = (process.env.ABLETON_MIND_LOG_LEVEL ?? "info").toLowerCase();
  if (raw === "debug" || raw === "info" || raw === "warn" || raw === "error") {
    return raw;
  }
  return "info";
}

const currentLevel = resolveLevel();
const currentWeight = LEVEL_WEIGHT[currentLevel];

function emit(level: LogLevel, message: string, meta?: Record<string, unknown>): void {
  if (LEVEL_WEIGHT[level] < currentWeight) return;
  const ts = new Date().toISOString();
  const base = `[${ts}] [${level.toUpperCase()}] ${message}`;
  const line = meta ? `${base} ${safeJson(meta)}` : base;
  // process.stderr.write instead of console.error to ensure no accidental
  // console interception leaks to stdout.
  process.stderr.write(`${line}\n`);
}

function safeJson(meta: Record<string, unknown>): string {
  try {
    return JSON.stringify(meta);
  } catch {
    return "[unserializable meta]";
  }
}

export const logger = {
  level: currentLevel,
  debug: (message: string, meta?: Record<string, unknown>) => emit("debug", message, meta),
  info: (message: string, meta?: Record<string, unknown>) => emit("info", message, meta),
  warn: (message: string, meta?: Record<string, unknown>) => emit("warn", message, meta),
  error: (message: string, meta?: Record<string, unknown>) => emit("error", message, meta),
};
