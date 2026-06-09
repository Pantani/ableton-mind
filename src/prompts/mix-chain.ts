import { z } from "zod";

import type { PromptDefinition } from "./index.js";

export const mixChainPrompt: PromptDefinition = {
  name: "build_mix_chain",
  description:
    "Build a mixing chain for a specific source type (drums, bass, vocal, master) using recipe defaults.",
  arguments: [
    {
      name: "source",
      description: "drums | bass | vocal | master | guitar | synth",
      required: true,
    },
    {
      name: "track_index",
      description: "Index da track destino (default 0; master = -1)",
      required: false,
    },
  ],
  argsSchema: z.object({
    source: z.string(),
    track_index: z.string().optional(),
  }),
  handler: ({ source = "drums", track_index = "0" }) => {
    const s = source.toLowerCase();
    const idx = track_index;
    const recommendations: Record<string, string[]> = {
      drums: [
        `1. \`apply_recipe { recipe_id: 'racks/parallel-comp', overrides: { track_index: ${idx} } }\``,
        "2. Drum Buss para glue: load + tweak Drive (curva não-linear, comece em 0.2-0.4) e Boom Freq.",
        "3. EQ Eight para shape — corte mud (200-400 Hz) e brilhe (8-12 kHz).",
      ],
      bass: [
        `1. \`apply_recipe { recipe_id: 'mixing/bass-glue', overrides: { track_index: ${idx} } }\``,
        `2. Sidechain do kick: \`apply_recipe { recipe_id: 'racks/sidechain-rack', overrides: { track_index: ${idx} } }\``,
      ],
      vocal: [
        `1. \`apply_recipe { recipe_id: 'mixing/vocal-chain', overrides: { track_index: ${idx} } }\``,
        "2. De-essing (não temos recipe; setup manual EQ Eight bell @ 6-8 kHz dynamic).",
        "3. Add Reverb (send-style) com Predelay 30 ms.",
      ],
      master: [
        "1. `apply_recipe { recipe_id: 'mixing/master-bus', overrides: { limiter_ceiling: -0.3 } }` (track_index -1).",
        "2. Spectrum analyzer (instance Spectrum) para checar balance final.",
      ],
    };
    const steps = recommendations[s] ?? [
      "Pick a recipe via `list_recipes { category: 'mixing' }`.",
      `Apply with \`apply_recipe { recipe_id: <id>, overrides: { track_index: ${idx} } }\`.`,
    ];
    return {
      messages: [
        {
          role: "user",
          content: {
            type: "text",
            text: [
              `# Build mix chain for ${source} track (index ${idx}).`,
              "",
              ...steps,
              "",
              'After each device.set_parameter, watch `verified` + `diff`. For non-linear params (`unit: "curve"` in knowledge), small steps (0.05).',
              "",
              `Call \`device_get_parameters { track_index: ${idx}, device_index: N }\` to discover what's loadable.`,
            ].join("\n"),
          },
        },
      ],
    };
  },
};
