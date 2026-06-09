import { z } from "zod";

import type { PromptDefinition } from "./index.js";

export const soundDesignPrompt: PromptDefinition = {
  name: "sound_design_session",
  description:
    "Explore a synthesizer's parameter space to find a specific sound (lead, pad, bass, pluck, etc).",
  arguments: [
    {
      name: "synth",
      description: "wavetable | operator | drift | bass | meld | sampler",
      required: true,
    },
    { name: "target", description: "lead | pad | pluck | bass | stab | drone", required: true },
    { name: "track_index", description: "Index da track (default 0)", required: false },
  ],
  argsSchema: z.object({
    synth: z.string(),
    target: z.string(),
    track_index: z.string().optional(),
  }),
  handler: ({ synth = "wavetable", target = "lead", track_index = "0" }) => {
    const startParams: Record<string, string[]> = {
      pad: [
        "Env 1 Attack: 2-5s",
        "Env 1 Release: 4-8s",
        "Filter Freq: ~3 kHz",
        "Unison Voices: 4-8 (se disponível)",
      ],
      lead: [
        "Env 1 Attack: 0.01s",
        "Env 1 Release: 0.3s",
        "Filter Freq: full open",
        "Drive/Sat: light",
      ],
      pluck: [
        "Env 1 Decay: 0.3s",
        "Env 1 Sustain: 0",
        "Filter Env Amount: high",
        "Filter Freq baixo",
      ],
      bass: [
        "Osc Type: Saw/Square",
        "Sub Gain: 0.5+",
        "Filter LP24 @ 200-800 Hz",
        "Filter Reso: subtle",
      ],
      stab: ["Env Decay: 0.1-0.3s", "Env Sustain: 0", "Filter Reso: high"],
      drone: ["Env Attack: 5s+", "Env Sustain: 1", "LFO mod no Pitch (subtle)", "Reverb wet"],
    };
    const tips = startParams[target.toLowerCase()] ?? [
      "Explore params via `device_get_parameters`.",
    ];
    return {
      messages: [
        {
          role: "user",
          content: {
            type: "text",
            text: [
              `# Sound design: ${target} no ${synth}, track ${track_index}.`,
              "",
              `1. **Load synth**: \`browser.load_item { path: ["instruments", "${synth}", "Init"] }\`.`,
              "",
              `2. **List params**: \`device_get_parameters { track_index: ${track_index}, device_index: 0 }\`. Knowledge enriquece com unit/description.`,
              "",
              `3. **Starting point para ${target}:**`,
              ...tips.map((t) => `   - ${t}`),
              "",
              "4. **Tweak loop:**",
              "   - `device_set_parameter` por nome (parameter_name) é mais ergonômico que index.",
              '   - Watch `verified` + `diff` no retorno. Curve params (`unit: "curve"`): passos de 0.05.',
              "",
              "5. **Verify aural:** crie clip MIDI de teste com 2-3 notas (`clip.create_midi` + `clip.add_notes`), `clip.fire`, ouça.",
              "",
              "6. **Iterate.** Se som não bate intent, ajuste params chave de novo. `session_snapshot` antes / `session_diff` depois mostra exatamente o que mudou.",
            ].join("\n"),
          },
        },
      ],
    };
  },
};
