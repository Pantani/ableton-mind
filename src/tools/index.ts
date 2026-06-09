/**
 * Registry de tools MCP.
 *
 * Cycle 5: 21 tools registradas. **Paridade ahujasid 22/22** (faltava
 * load_browser_item/get_device_parameters/set_device_parameter — agora aqui).
 *
 * Verify loop integrado em set_tempo, track_set_volume, track_set_name,
 * clip_set_name (TD-013).
 *
 * Phase 2 começa neste ciclo com listeners no bridge — repasse para MCP
 * notifications acontece no server bootstrap (src/server/index.ts).
 */

import type { ToolDefinition } from "../server/define-tool.js";

import { arrangementAddAutomationPointTool } from "./arrangement.js";
import { browserGetCategoriesTool, browserLoadItemTool } from "./browser.js";
import {
  clipAddNotesTool,
  clipFireTool,
  clipSetEnvelopeTool,
  clipSetLoopTool,
  clipSetNameTool,
  clipStopTool,
  createMidiClipTool,
} from "./clip.js";
import { deviceGetParametersTool, deviceSetParameterTool } from "./device.js";
import { renderPreviewTool, sessionDiffTool, sessionSnapshotTool } from "./preview.js";
import { listPromptsTool } from "./prompts.js";
import { pushSetButtonLedTool, pushSetModeTool, pushSetPadColorTool } from "./push.js";
import { applyRecipeTool, listRecipesTool } from "./recipe.js";
import { listResourcesTool } from "./resources.js";
import { sceneFireTool } from "./scene.js";
import { sessionGetInfoTool } from "./session.js";
import {
  trackCreateTool,
  trackGetInfoTool,
  trackListTool,
  trackSetNameTool,
  trackSetVolumeTool,
  trackUpsertTool,
} from "./track.js";
import { playTool, setTempoTool, stopTool } from "./transport.js";

export {
  applyRecipeTool,
  arrangementAddAutomationPointTool,
  listRecipesTool,
  listPromptsTool,
  listResourcesTool,
  pushSetButtonLedTool,
  pushSetModeTool,
  pushSetPadColorTool,
  renderPreviewTool,
  sessionDiffTool,
  sessionSnapshotTool,
  browserGetCategoriesTool,
  browserLoadItemTool,
  clipAddNotesTool,
  clipFireTool,
  clipSetEnvelopeTool,
  clipSetLoopTool,
  clipSetNameTool,
  clipStopTool,
  createMidiClipTool,
  deviceGetParametersTool,
  deviceSetParameterTool,
  playTool,
  sceneFireTool,
  sessionGetInfoTool,
  setTempoTool,
  stopTool,
  trackCreateTool,
  trackGetInfoTool,
  trackListTool,
  trackSetNameTool,
  trackSetVolumeTool,
  trackUpsertTool,
};

// Concrete tools are ToolDefinition<ZodObject<...>, ZodObject<...>>; we erase
// the per-tool generics to the default ToolDefinition[] for the registry. The
// cast goes through `unknown` because the generic position is invariant.
export const allTools = [
  // transport
  playTool,
  stopTool,
  setTempoTool,
  // track
  trackListTool,
  trackGetInfoTool,
  trackCreateTool,
  trackUpsertTool,
  trackSetNameTool,
  trackSetVolumeTool,
  // clip
  createMidiClipTool,
  clipAddNotesTool,
  clipFireTool,
  clipStopTool,
  clipSetNameTool,
  clipSetLoopTool,
  clipSetEnvelopeTool,
  // scene
  sceneFireTool,
  // session
  sessionGetInfoTool,
  // browser
  browserGetCategoriesTool,
  browserLoadItemTool,
  // device
  deviceGetParametersTool,
  deviceSetParameterTool,
  // arrangement (Phase 4)
  arrangementAddAutomationPointTool,
  // Phase 5 — preview & verify
  sessionSnapshotTool,
  sessionDiffTool,
  renderPreviewTool,
  // Recipes (Trilha C)
  listRecipesTool,
  applyRecipeTool,
  // Prompts discovery
  listPromptsTool,
  // Phase 6 — Push
  pushSetPadColorTool,
  pushSetButtonLedTool,
  pushSetModeTool,
] as unknown as ToolDefinition[];
