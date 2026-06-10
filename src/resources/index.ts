/**
 * MCP Resources registry (ADR-0011).
 *
 * Resources are read-only URIs that MCP clients read via `resources/read`.
 * Unlike tools, they NEVER cause side effects.
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
  /** Canonical URI of the resource (ex: `live://session/state`). */
  uri: string;
  /** Friendly name used by the MCP client. */
  name: string;
  description: string;
  mimeType: string;
  /**
   * Read function — receives an optional `BridgeClient` (for resources that
   * query Live). Static resources can ignore it.
   */
  read: (bridge: BridgeClient | null) => Promise<ResourceReadResult>;
}

export { knowledgeDevicesResource, recipesIndexResource, sessionStateResource };

export const allResources: ResourceDefinition[] = [
  sessionStateResource,
  knowledgeDevicesResource,
  recipesIndexResource,
];

/** Lookup by exact URI. */
export function loadResource(uri: string): ResourceDefinition | null {
  return allResources.find((r) => r.uri === uri) ?? null;
}
