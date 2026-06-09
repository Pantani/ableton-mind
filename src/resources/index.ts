/**
 * MCP Resources registry (ADR-0011).
 *
 * Resources são URIs read-only que clientes MCP leem via `resources/read`.
 * Diferente de tools, NUNCA causam efeito colateral.
 */

import type { BridgeClient } from "../server/context.js";

import { knowledgeDevicesResource } from "./knowledge-devices.js";
import { recipesIndexResource } from "./recipes-index.js";
import { sessionStateResource } from "./session-state.js";

export interface ResourceContents {
  uri: string;
  mimeType: string;
  text: string;
}

export interface ResourceReadResult {
  contents: ResourceContents[];
}

export interface ResourceDefinition {
  /** URI canônico do resource (ex: `live://session/state`). */
  uri: string;
  /** Nome amigável usado pelo cliente MCP. */
  name: string;
  description: string;
  mimeType: string;
  /**
   * Função read — recebe um `BridgeClient` opcional (para resources que
   * consultam o Live). Resources estáticos podem ignorar.
   */
  read: (bridge: BridgeClient | null) => Promise<ResourceReadResult>;
}

export { knowledgeDevicesResource, recipesIndexResource, sessionStateResource };

export const allResources: ResourceDefinition[] = [
  sessionStateResource,
  knowledgeDevicesResource,
  recipesIndexResource,
];

/** Lookup por URI exato. */
export function loadResource(uri: string): ResourceDefinition | null {
  return allResources.find((r) => r.uri === uri) ?? null;
}
