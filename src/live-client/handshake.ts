/**
 * Handshake `system.hello` — primeira mensagem na conexão.
 *
 * Contrato em `_workspace/contracts/phase0-methods.md` §1.
 * Bridge não responde nenhum outro método até receber hello.
 */

import { z } from "zod";

import { logger } from "../utils/logger.js";
import type { TcpJsonRpcClient } from "./tcp-client.js";

export const helloParamsSchema = z.object({
  client: z.string(),
  version: z.string(),
});
export type HelloParams = z.infer<typeof helloParamsSchema>;

export const helloResultSchema = z.object({
  bridge: z.string(),
  version: z.string(),
  live_version: z.string(),
  python_version: z.string(),
  protocol_version: z.string(),
});
export type HelloResult = z.infer<typeof helloResultSchema>;

/** Versão TS client publicada no handshake. Mantém sync com package.json. */
export const TS_CLIENT_VERSION = "0.0.1";

/** Versão de protocolo esperada (frozen Phase 0). */
export const EXPECTED_PROTOCOL_VERSION = "0.1";

export class ProtocolMismatchError extends Error {
  public readonly expected: string;
  public readonly received: string;

  constructor(expected: string, received: string) {
    super(`bridge protocol_version mismatch: expected ${expected}, got ${received}`);
    this.name = "ProtocolMismatchError";
    this.expected = expected;
    this.received = received;
  }
}

/**
 * Roda o handshake. Valida result com Zod. Loga banner com versões.
 * NÃO falha em mismatch de protocol_version por enquanto (Phase 0 = warn);
 * Phase 1 pode promover para erro hard.
 */
export async function performHandshake(
  client: TcpJsonRpcClient,
  params: HelloParams = { client: "ableton-mind/ts", version: TS_CLIENT_VERSION },
): Promise<HelloResult> {
  const raw = await client.call("system.hello", params);
  const parseResult = helloResultSchema.safeParse(raw);
  if (!parseResult.success) {
    throw new Error(`invalid system.hello response: ${parseResult.error.message}`);
  }
  const result = parseResult.data;

  logger.info("handshake ok", {
    bridge: result.bridge,
    bridge_version: result.version,
    live_version: result.live_version,
    python_version: result.python_version,
    protocol_version: result.protocol_version,
  });

  if (result.protocol_version !== EXPECTED_PROTOCOL_VERSION) {
    logger.warn("protocol_version mismatch", {
      expected: EXPECTED_PROTOCOL_VERSION,
      received: result.protocol_version,
    });
  }

  return result;
}
