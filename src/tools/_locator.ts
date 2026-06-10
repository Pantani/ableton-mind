/**
 * `parameter_path` → `parameter_locator` resolver (ADR-0006).
 *
 * Accepts strings:
 *   - "mixer.volume"
 *   - "mixer.panning"
 *   - "mixer.send.<i>"
 *   - "device.<i>.parameter.<n>"
 *
 * Returns a `{kind, ...}` object that the bridge consumes in
 * `clip.envelope_set_points` and `arrangement.add_automation_point`.
 *
 * Resolution by parameter NAME (e.g.: "device.0.Cutoff") is deferred to Cycle 8:
 * would require 1 extra round-trip of `device.get_parameters` — add async
 * overload when needed.
 */

import { z } from "zod";

export const parameterPathSchema = z
  .string()
  .min(1)
  .describe("mixer.volume | mixer.panning | mixer.send.<i> | device.<i>.parameter.<n>");

export type ParameterLocator =
  | { kind: "mixer_volume" }
  | { kind: "mixer_panning" }
  | { kind: "mixer_send"; send_index: number }
  | { kind: "device_param"; device_index: number; parameter_index: number };

export function parseParameterLocator(path: string): ParameterLocator {
  const trimmed = path.trim();
  if (trimmed === "mixer.volume") return { kind: "mixer_volume" };
  if (trimmed === "mixer.panning") return { kind: "mixer_panning" };

  const sendMatch = trimmed.match(/^mixer\.send\.(\d+)$/);
  if (sendMatch) {
    return { kind: "mixer_send", send_index: Number(sendMatch[1]) };
  }

  const devMatch = trimmed.match(/^device\.(\d+)\.parameter\.(\d+)$/);
  if (devMatch) {
    return {
      kind: "device_param",
      device_index: Number(devMatch[1]),
      parameter_index: Number(devMatch[2]),
    };
  }

  throw new Error(
    `unknown parameter_path "${path}". Valid: mixer.volume | mixer.panning | mixer.send.<i> | device.<i>.parameter.<n>`,
  );
}
