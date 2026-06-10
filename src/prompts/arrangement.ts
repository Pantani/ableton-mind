import { z } from "zod";

import type { PromptDefinition } from "./index.js";

export const arrangementPrompt: PromptDefinition = {
  name: "build_arrangement",
  description:
    "Lay out a song arrangement (intro/build/drop/break/outro) using session scenes and clip lengths.",
  arguments: [
    {
      name: "structure",
      description: "intro-build-drop-break-outro | aaba | verse-chorus | minimal",
      required: true,
    },
    { name: "tempo", description: "BPM (default 128)", required: false },
    { name: "bars_per_section", description: "Bars per section (default 8)", required: false },
  ],
  argsSchema: z.object({
    structure: z.string(),
    tempo: z.string().optional(),
    bars_per_section: z.string().optional(),
  }),
  handler: ({
    structure = "intro-build-drop-break-outro",
    tempo = "128",
    bars_per_section = "8",
  }) => {
    const sections =
      structure === "intro-build-drop-break-outro"
        ? ["Intro", "Build", "Drop", "Break", "Outro"]
        : structure === "aaba"
          ? ["A1", "A2", "B", "A3"]
          : structure === "verse-chorus"
            ? ["Intro", "Verse 1", "Chorus 1", "Verse 2", "Chorus 2", "Bridge", "Chorus 3", "Outro"]
            : ["Section A", "Section B"];
    const beatsPerSection = Number(bars_per_section) * 4;
    return {
      messages: [
        {
          role: "user",
          content: {
            type: "text",
            text: [
              `# Arrangement: ${structure} @ ${tempo} BPM.`,
              "",
              `1. \`transport.set_tempo { bpm: ${tempo} }\``,
              "",
              `2. For each section, create 1 scene with clips for the elements (drums/bass/synth/fx). ${bars_per_section} bars each = ${beatsPerSection} beats.`,
              "",
              ...sections.map(
                (s, i) =>
                  `   ${i + 1}. **${s}** — \`clip.create_midi\` on each track with length_beats=${beatsPerSection}, name="${s}".`,
              ),
              "",
              `3. Total: ${sections.length} scenes × ${bars_per_section} bars = ${sections.length * Number(bars_per_section)} bars total.`,
              "",
              `4. (Optional) \`apply_recipe { recipe_id: 'arrangements/tech-house-7min' }\` for a ready-made scaffold.`,
              "",
              "5. For dynamic automation between sections, use `clip_set_envelope` with `parameter_path: 'mixer.volume'` and points per section.",
            ].join("\n"),
          },
        },
      ],
    };
  },
};
