/**
 * Logger que escreve EXCLUSIVAMENTE em stderr.
 *
 * O servidor MCP usa stdio transport: stdout é canal sagrado do protocolo MCP.
 * Qualquer write no stdout que não seja uma mensagem MCP válida quebra o cliente.
 * Portanto todo log de produção, debug, warn, error vai em stderr.
 *
 * Níveis: debug < info < warn < error.
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
  // process.stderr.write em vez de console.error para garantir que não há
  // nenhuma interceptação acidental do console que vaze pro stdout.
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
