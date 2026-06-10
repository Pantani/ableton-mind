/**
 * JSON-RPC 2.0 types and schemas from `_workspace/contracts/jsonrpc.md`.
 *
 * Mirrors the frozen Phase 0 contract 1:1. Any change here requires an ADR
 * and PROPOSED-change.md in the workspace.
 */

import { z } from "zod";

// ---------- Envelope -----------------------------------------------------

/** JSON-RPC ID: number or string (the spec accepts both; we always use number). */
export const jsonRpcIdSchema = z.union([z.number().int(), z.string()]);
export type JsonRpcId = z.infer<typeof jsonRpcIdSchema>;

/** Request: has `id`, `method` and optional `params`. */
export const jsonRpcRequestSchema = z.object({
  jsonrpc: z.literal("2.0"),
  id: jsonRpcIdSchema,
  method: z.string().min(1),
  params: z.unknown().optional(),
});
export type JsonRpcRequest = z.infer<typeof jsonRpcRequestSchema>;

/** JSON-RPC error: code + message + optional data. */
export const jsonRpcErrorObjectSchema = z.object({
  code: z.number().int(),
  message: z.string(),
  data: z.unknown().optional(),
});
export type JsonRpcErrorObject = z.infer<typeof jsonRpcErrorObjectSchema>;

/** Success response: result present, error absent. */
export const jsonRpcSuccessSchema = z.object({
  jsonrpc: z.literal("2.0"),
  id: jsonRpcIdSchema,
  result: z.unknown(),
});

/** Error response: error present, result absent. */
export const jsonRpcErrorResponseSchema = z.object({
  jsonrpc: z.literal("2.0"),
  id: jsonRpcIdSchema.nullable(),
  error: jsonRpcErrorObjectSchema,
});

/** Response union, discriminated by the presence of `result` vs `error`. */
export const jsonRpcResponseSchema = z.union([jsonRpcSuccessSchema, jsonRpcErrorResponseSchema]);
export type JsonRpcResponse = z.infer<typeof jsonRpcResponseSchema>;

/** Notification: no `id`, server -> client. */
export const jsonRpcNotificationSchema = z.object({
  jsonrpc: z.literal("2.0"),
  method: z.string().min(1),
  params: z.unknown().optional(),
});
export type JsonRpcNotification = z.infer<typeof jsonRpcNotificationSchema>;

/** Any incoming bridge message, either a response or a notification. */
export const jsonRpcIncomingSchema = z.union([
  jsonRpcSuccessSchema,
  jsonRpcErrorResponseSchema,
  jsonRpcNotificationSchema,
]);
export type JsonRpcIncoming = z.infer<typeof jsonRpcIncomingSchema>;

// ---------- Error codes (contract `_workspace/contracts/jsonrpc.md`) -----

/** Codes reserved by the JSON-RPC 2.0 spec. */
export const JSON_RPC_RESERVED_ERRORS = {
  PARSE_ERROR: -32700,
  INVALID_REQUEST: -32600,
  METHOD_NOT_FOUND: -32601,
  INVALID_PARAMS: -32602,
  INTERNAL_ERROR: -32603,
} as const;

/** ableton-mind custom codes (range -32000 to -32099). */
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

/** Structured error thrown by the client when the bridge returns `error`. */
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

/** Transport error (timeout, socket closed, parse failed). */
export class JsonRpcTransportError extends Error {
  public override readonly cause?: unknown;

  constructor(message: string, cause?: unknown) {
    super(message);
    this.name = "JsonRpcTransportError";
    this.cause = cause;
  }
}

/** Serializes a request as NDJSON (one line). */
export function encodeRequest(req: JsonRpcRequest): string {
  return `${JSON.stringify(req)}\n`;
}

/** Parses and validates one NDJSON line received from the bridge. */
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

/** Discriminator: is this a response (has id and result|error)? */
export function isResponse(msg: JsonRpcIncoming): msg is JsonRpcResponse {
  return "id" in msg && ("result" in msg || "error" in msg);
}

/** Discriminator: is this a notification (no id, only method)? */
export function isNotification(msg: JsonRpcIncoming): msg is JsonRpcNotification {
  return "method" in msg && !("id" in msg);
}
