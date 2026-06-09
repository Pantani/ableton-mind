/**
 * MCP SDK internals adapter (TD-019).
 *
 * Centraliza TODO o acesso a propriedades não-públicas do
 * `@modelcontextprotocol/sdk`. Se a forma do SDK mudar entre versões
 * (1.x → 2.x), só este arquivo precisa atualizar.
 *
 * Tudo que aqui acessa via cast deve ter um teste correspondente (vê
 * `tests/server-notifications.test.ts`) — assim quebra cedo se o SDK mudar.
 */

import type { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";

/**
 * Função que envia notification do MCP server para o cliente.
 *
 * Em `@modelcontextprotocol/sdk` 1.x o `McpServer` (facade) NÃO expõe
 * `sendNotification` no top level — está no underlying `Server` instance
 * acessível via `.server`. Encapsulamos esse cast aqui.
 */
export type ServerNotifier = (method: string, params: unknown) => Promise<void>;

interface ServerInternals {
  server?: {
    notification?: (n: { method: string; params: unknown }) => Promise<void>;
  };
}

/**
 * Devolve um notifier — função que recebe `(method, params)` e dispara a
 * notification MCP. Lança Error se o SDK não expõe o caminho esperado
 * (proteção contra incompat futura).
 */
export function getServerNotifier(server: McpServer): ServerNotifier {
  const internals = server as unknown as ServerInternals;
  const underlying = internals.server;
  if (!underlying || typeof underlying.notification !== "function") {
    throw new SdkIncompatibilityError(
      "McpServer.server.notification is not available; SDK incompatibility",
    );
  }
  return async (method, params) => {
    await underlying.notification!({ method, params });
  };
}

/** Lançado quando o internal do SDK não é o esperado. */
export class SdkIncompatibilityError extends Error {
  constructor(message: string) {
    super(message);
    this.name = "SdkIncompatibilityError";
  }
}
