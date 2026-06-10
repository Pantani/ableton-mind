/**
 * Tools Phase 6 — Push 2/3 LED/pad control (ADR-0008).
 *
 * Bridge handler sends MIDI Sysex. In headless or without Push detected,
 * `-32000` with `detected: false`.
 */

import { z } from "zod";

import { defineTool } from "../server/define-tool.js";

const PUSH_BUTTONS = [
  "Play",
  "Record",
  "Stop",
  "Tap Tempo",
  "Metronome",
  "Undo",
  "Mute",
  "Solo",
  "Master",
  "Note",
  "Session",
  "Browse",
  "Add Track",
  "Add Device",
  "Setup",
  "Shift",
  "Select",
] as const;

// ----- push_set_pad_color ----------------------------------------------------

const padInputSchema = z.object({
  pad: z.number().int().min(0).max(63).describe("Push pad grid 0..63 (8x8)."),
  color: z.number().int().min(0).max(127),
});

const padOutputSchema = z.object({
  ok: z.literal(true),
  verified: z.literal(true),
  pad: z.number().int().nonnegative(),
  color: z.number().int().nonnegative(),
  sent: z.literal(true),
});

export const pushSetPadColorTool = defineTool({
  name: "push_set_pad_color",
  description:
    "Set the color of a Push pad (0..63 grid). color is 0..127 (Ableton Push color palette). Requires Push 2/3 detected.",
  input: padInputSchema,
  output: padOutputSchema,
  handler: async (input, ctx) => {
    const raw = await ctx.bridge.call("push.set_pad_color", {
      pad: input.pad,
      color: input.color,
    });
    const parsed = padOutputSchema.omit({ ok: true, verified: true }).parse(raw);
    return { ok: true as const, verified: true as const, ...parsed };
  },
});

// ----- push_set_button_led ---------------------------------------------------

const buttonInputSchema = z.object({
  button: z.enum(PUSH_BUTTONS),
  color: z.number().int().min(0).max(127),
  mode: z.enum(["solid", "blink", "pulse"]).optional(),
});

const buttonOutputSchema = z.object({
  ok: z.literal(true),
  verified: z.literal(true),
  button: z.string(),
  color: z.number().int().nonnegative(),
  mode: z.string(),
  sent: z.literal(true),
});

// ----- push_set_mode ---------------------------------------------------------

const modeInputSchema = z.object({
  mode: z.enum(["note", "session", "drum", "step"]),
});

const modeOutputSchema = z.object({
  ok: z.literal(true),
  verified: z.literal(true),
  mode: z.string(),
  sent: z.literal(true),
});

export const pushSetModeTool = defineTool({
  name: "push_set_mode",
  description:
    "Switch Push 2/3 to a top-level mode: note (instrument) / session (clip grid) / drum (drum rack) / step (step seq).",
  input: modeInputSchema,
  output: modeOutputSchema,
  handler: async (input, ctx) => {
    const raw = await ctx.bridge.call("push.set_mode", { mode: input.mode });
    const parsed = modeOutputSchema.omit({ ok: true, verified: true }).parse(raw);
    return { ok: true as const, verified: true as const, ...parsed };
  },
});

export const pushSetButtonLedTool = defineTool({
  name: "push_set_button_led",
  description:
    "Set the LED color/mode of a Push transport/utility button. mode default 'solid'. Requires Push 2/3 detected.",
  input: buttonInputSchema,
  output: buttonOutputSchema,
  handler: async (input, ctx) => {
    const raw = await ctx.bridge.call("push.set_button_led", {
      button: input.button,
      color: input.color,
      mode: input.mode ?? "solid",
    });
    const parsed = buttonOutputSchema.omit({ ok: true, verified: true }).parse(raw);
    return { ok: true as const, verified: true as const, ...parsed };
  },
});
