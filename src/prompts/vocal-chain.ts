import { z } from "zod";

import type { PromptDefinition } from "./index.js";

export const vocalChainPrompt: PromptDefinition = {
  name: "process_vocal_take",
  description:
    "Process a recorded vocal take with a complete chain (gate → EQ → comp → de-ess → reverb send).",
  arguments: [
    { name: "track_index", description: "Vocal track index", required: true },
    { name: "style", description: "podcast | pop | rap | jazz | ambient", required: false },
  ],
  argsSchema: z.object({
    track_index: z.string(),
    style: z.string().optional(),
  }),
  handler: ({ track_index = "0", style = "pop" }) => {
    const styleHints: Record<string, string> = {
      podcast:
        "Comp ratio 3:1, threshold -18. Gate threshold -45 (room noise rejection). HP @ 80 Hz.",
      pop: "Comp ratio 4:1, threshold -20. Bright EQ shelf @ 10 kHz +2 dB. Reverb predelay 20 ms.",
      rap: "Aggressive comp 6:1, threshold -16. Saturator subtle. HP @ 100 Hz, presence boost 3-5 kHz.",
      jazz: "Soft comp 2:1, threshold -22. Long reverb tail (decay 2.5s+). No distortion.",
      ambient: "Minimal comp 2:1. Heavy reverb wet (40%). Add chorus subtle.",
    };
    const hint = styleHints[style.toLowerCase()] ?? styleHints.pop;
    return {
      messages: [
        {
          role: "user",
          content: {
            type: "text",
            text: [
              `# Vocal chain @ track ${track_index} (style: ${style}).`,
              "",
              `1. \`apply_recipe { recipe_id: 'mixing/vocal-chain', overrides: { track_index: ${track_index} } }\``,
              "",
              `2. **Style tweaks (${style}):** ${hint}`,
              "",
              "3. **Manual de-essing** (no recipe yet):",
              "   - Add EQ Eight (device_index 3): bell band @ 6-8 kHz, gain -6 dB, Q narrow (4-6).",
              "   - For dynamic de-essing: link a Compressor with internal sidechain EQ @ 6-8 kHz.",
              "",
              "4. **Send to reverb:** if there is a Return track with reverb, use `track.set_volume` to open the appropriate send.",
              "",
              `5. **Verify:** \`track_get_info { index: ${track_index} }\` shows final volume_db + num_devices. Compare before/after with \`session_snapshot/diff\`.`,
            ].join("\n"),
          },
        },
      ],
    };
  },
};
