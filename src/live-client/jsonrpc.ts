/**
 * Tipos e schemas JSON-RPC 2.0 conforme `_workspace/contracts/jsonrpc.md`.
 *
 * Espelha 1:1 o contrato congelado para Phase 0. Qualquer mudança aqui
 * exige ADR e PROPOSED-change.md no workspace.
 */

import { z } from "zod";

// ---------- Envelope -----------------------------------------------------

/** ID JSON-RPC: number ou string (spec aceita ambos; usamos sempre number). */
export const jsonRpcIdSchema = z.union([z.number().int(), z.string()]);
export type JsonRpcId = z.infer<typeof jsonRpcIdSchema>;

/** Request: tem `id`, `method` e `params` opcional. */
export const jsonRpcRequestSchema = z.object({
  jsonrpc: z.literal("2.0"),
  id: jsonRpcIdSchema,
  method: z.string().min(1),
  params: z.unknown().optional(),
});
export type JsonRpcRequest = z.infer<typeof jsonRpcRequestSchema>;

/** Erro JSON-RPC: code + message + data opcional. */
export const jsonRpcErrorObjectSchema = z.object({
  code: z.number().int(),
  message: z.string(),
  data: z.unknown().optional(),
});
export type JsonRpcErrorObject = z.infer<typeof jsonRpcErrorObjectSchema>;

/** Response success: result presente, error ausente. */
export const jsonRpcSuccessSchema = z.object({
  jsonrpc: z.literal("2.0"),
  id: jsonRpcIdSchema,
  result: z.unknown(),
});

/** Response error: error presente, result ausente. */
export const jsonRpcErrorResponseSchema = z.object({
  jsonrpc: z.literal("2.0"),
  id: jsonRpcIdSchema.nullable(),
  error: jsonRpcErrorObjectSchema,
});

/** Response union — discriminada por presença de `result` vs `error`. */
export const jsonRpcResponseSchema = z.union([jsonRpcSuccessSchema, jsonRpcErrorResponseSchema]);
export type JsonRpcResponse = z.infer<typeof jsonRpcResponseSchema>;

/** Notification: sem `id`, server → client. */
export const jsonRpcNotificationSchema = z.object({
  jsonrpc: z.literal("2.0"),
  method: z.string().min(1),
  params: z.unknown().optional(),
});
export type JsonRpcNotification = z.infer<typeof jsonRpcNotificationSchema>;

/** Qualquer mensagem chegando do bridge — pode ser response ou notification. */
export const jsonRpcIncomingSchema = z.union([
  jsonRpcSuccessSchema,
  jsonRpcErrorResponseSchema,
  jsonRpcNotificationSchema,
]);
export type JsonRpcIncoming = z.infer<typeof jsonRpcIncomingSchema>;

// ---------- Error codes (contract `_workspace/contracts/jsonrpc.md`) -----

/** Códigos reservados pela spec JSON-RPC 2.0. */
export const JSON_RPC_RESERVED_ERRORS = {
  PARSE_ERROR: -32700,
  INVALID_REQUEST: -32600,
  METHOD_NOT_FOUND: -32601,
  INVALID_PARAMS: -32602,
  INTERNAL_ERROR: -32603,
} as const;

/** Códigos custom do ableton-mind (faixa -32000 a -32099). */
export const ABLETON_MIND_ERRORS = {
  LIVE_NOT_RUNNING: -32000,
  LIVE_API_CALL_FAILED: -32001,
  OBJECT_NOT_FOUND: -32002,
  TYPE_MISMATCH: -32003,
  OUT_OF_RANGE: -32004,
  INVALID_STATE: -32005,
  TRANSACTION_ERROR: -32006,
  LISTENER_ERROR: -32007,
  KNOWLEDGE_LOOKUP_FAILED: -32008,
} as const;

// ---------- Helpers ------------------------------------------------------

/** Erro estruturado lançado pelo cliente quando o bridge devolve `error`. */
export class JsonRpcRemoteError extends Error {
  public readonly code: number;
  public readonly data: unknown;

  constructor(err: JsonRpcErrorObject) {
    super(err.message);
    this.name = "JsonRpcRemoteError";
    this.code = err.code;
    this.data = err.data;
  }
}

/** Erro do transport (timeout, socket fechou, parse falhou). */
export class JsonRpcTransportError extends Error {
  public override readonly cause?: unknown;

  constructor(message: string, cause?: unknown) {
    super(message);
    this.name = "JsonRpcTransportError";
    this.cause = cause;
  }
}

/** Serializa um request para NDJSON (uma linha). */
export function encodeRequest(req: JsonRpcRequest): string {
  return `${JSON.stringify(req)}\n`;
}

/** Faz parse + validação de uma linha NDJSON recebida do bridge. */
export function decodeIncoming(line: string): JsonRpcIncoming {
  let parsed: unknown;
  try {
    parsed = JSON.parse(line);
  } catch (cause) {
    throw new JsonRpcTransportError(`failed to parse JSON line: ${line.slice(0, 200)}`, cause);
  }
  const result = jsonRpcIncomingSchema.safeParse(parsed);
  if (!result.success) {
    throw new JsonRpcTransportError(`invalid JSON-RPC envelope: ${result.error.message}`);
  }
  return result.data;
}

/** Discriminator: é response (tem id e result|error)? */
export function isResponse(msg: JsonRpcIncoming): msg is JsonRpcResponse {
  return "id" in msg && ("result" in msg || "error" in msg);
}

/** Discriminator: é notification (sem id, só method)? */
export function isNotification(msg: JsonRpcIncoming): msg is JsonRpcNotification {
  return "method" in msg && !("id" in msg);
}
