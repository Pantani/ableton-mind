/**
 * Notification forwarder bridge → MCP (TD-015).
 *
 * O `TcpJsonRpcClient` emite `notification` (method, params) sempre que recebe
 * uma mensagem JSON-RPC sem `id`. Nós encaminhamos para o MCP client conforme
 * ADR-0005:
 *
 * - Apenas métodos com prefixo `event.` são repassados.
 * - O resto é logado e descartado (proteção contra drift).
 * - Erros do MCP `sendNotification` são logados e engolidos — não derrubam a
 *   conexão com a bridge.
 *
 * O MCP SDK 1.x expõe `server.server.notification(...)` (a propriedade
 * `.server` é o underlying `Server` instance). Usamos isso porque `McpServer`
 * (a facade `1.x`) ainda não tem `sendNotification` público no top level.
 *
 * Se a API quebrar entre SDK versões, isolamos a chamada num adapter
 * (`sendNotification(method, params)`) — testes mockam só esse adapter.
 */

import type { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";

import { logger } from "../utils/logger.js";
import { getServerNotifier } from "./_mcp-internals.js";

const EVENT_PREFIX = "event.";

/**
 * Função pequena que sabe como enviar notification via MCP SDK. Trocar aqui
 * se o SDK evoluir. Injetável para testes.
 */
export type McpNotifier = (method: string, params: unknown) => Promise<void> | void;

/** Default notifier que delega para o SDK internals adapter (TD-019). */
export function createMcpNotifier(server: McpServer): McpNotifier {
  // Centraliza o acesso a internals num módulo dedicado (`_mcp-internals.ts`).
  return getServerNotifier(server);
}

/**
 * Recebe `(method, params)` vindos do bridge. Repassa se for `event.*`,
 * descarta caso contrário.
 *
 * Retorna `true` se repassou, `false` se ignorou.
 */
export async function forwardNotification(
  notifier: McpNotifier,
  method: string,
  params: unknown,
): Promise<boolean> {
  if (!method.startsWith(EVENT_PREFIX)) {
    logger.warn("dropping notification with non-event method", { method });
    return false;
  }
  try {
    // Para integração com clientes MCP, mapeamos `event.foo_bar_changed` →
    // `notifications/event.foo_bar_changed` (spec MCP usa namespace
    // `notifications/*`). Mas como o subjacente `Server.notification` aceita
    // qualquer method string, deixamos o caller decidir adicionar prefix se
    // for útil. Por enquanto repassamos o method original — clientes MCP
    // veem `event.foo_bar_changed` direto.
    await notifier(method, params);
    return true;
  } catch (err) {
    logger.warn("MCP notification failed", {
      method,
      error: (err as Error).message,
    });
    return false;
  }
}

/**
 * Wire helper: anexa o forwarder ao client TCP.
 *
 * Retorna função `dispose()` para remover o listener (útil em shutdown ou
 * testes).
 */
export function attachNotificationForwarder(
  client: {
    on: (event: "notification", handler: (m: string, p: unknown) => void) => void;
    off?: (event: "notification", handler: (m: string, p: unknown) => void) => void;
  },
  notifier: McpNotifier,
): () => void {
  const handler = (method: string, params: unknown): void => {
    void forwardNotification(notifier, method, params);
  };
  client.on("notification", handler);
  return () => {
    if (typeof client.off === "function") {
      client.off("notification", handler);
    }
  };
}
