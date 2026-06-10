import { z } from "zod";

import type { PromptDefinition } from "./index.js";

const GENRE_BPM: Record<string, number> = {
  techno: 130,
  "tech-house": 126,
  house: 124,
  trance: 138,
  dnb: 174,
  jungle: 170,
  lofi: 90,
  hiphop: 90,
  trap: 140,
  "neo-soul": 95,
  ambient: 70,
};

const GENRE_KIT_HINTS: Record<string, string> = {
  techno:
    "Drum Cell with 909 kick, off-beat hat. Use recipe `drums/tech-house-kick` (adapt tempo).",
  "tech-house": "Use `drums/tech-house-kick` directly.",
  dnb: "Use recipe `drums/jungle-break` (adjust to 174 BPM).",
  jungle: "Use recipe `drums/jungle-break` directly.",
  lofi: "Use recipe `drums/lofi-kit`.",
  "neo-soul": "Loose swing kit. Drum Cell + Vinyl Distortion subtle.",
  trap: "808 kick with tune and long decay. Recipe `bass/sub-808` for the 808.",
};

export const genreTrackPrompt: PromptDefinition = {
  name: "create_genre_track",
  description:
    "Compose a full track in a specified genre using kit + bassline + chords + arrangement recipes.",
  arguments: [
    {
      name: "genre",
      description:
        "techno | tech-house | house | trance | dnb | jungle | lofi | hiphop | trap | neo-soul | ambient",
      required: true,
    },
    { name: "tempo", description: "BPM (default auto-derived from genre)", required: false },
    { name: "duration_min", description: "Duration in minutes (default 7)", required: false },
  ],
  argsSchema: z.object({
    genre: z.string(),
    tempo: z.string().optional(),
    duration_min: z.string().optional(),
  }),
  handler: ({ genre = "techno", tempo, duration_min }) => {
    const g = genre.toLowerCase();
    const bpm = tempo ?? String(GENRE_BPM[g] ?? 120);
    const minutes = duration_min ?? "7";
    const kitHint =
      GENRE_KIT_HINTS[g] ?? "Explore recipes via `list_recipes { category: 'drums' }`.";
    return {
      messages: [
        {
          role: "user",
          content: {
            type: "text",
            text: [
              `# Build a ${genre} track @ ${bpm} BPM, ~${minutes} minutes.`,
              "",
              "Use the ableton-mind MCP tools step by step. Suggested workflow:",
              "",
              `1. **transport.set_tempo** to ${bpm} BPM.`,
              "",
              `2. **Drums.** ${kitHint}`,
              "",
              "3. **Bass.** Pick from `list_recipes { category: 'bass' }`. Apply with `apply_recipe`.",
              `   - For ${genre}, a typical choice: \`bass/sub-808\` (electronic) or \`bass/reese\` (D&B).`,
              "",
              "4. **Chords/melody.** Pick from `list_recipes { category: 'chords' }`. Apply.",
              "   - Tip: `chords/neo-soul-progressions` works for many genres with `instrument_path_*` overrides.",
              "",
              `5. **Arrangement.** Use \`apply_recipe { recipe_id: 'arrangements/tech-house-7min' }\` and adjust scene lengths for ${minutes} minutes total.`,
              "",
              "6. **Mixing.** Apply `mixing/master-bus` on master, plus `mixing/bass-glue` on the bass track.",
              "",
              "7. **Verify.** Call `session_snapshot` before mutations; compare with `session_diff` afterward.",
              "",
              "Track verify on every mutation (`verified: true` + `diff: null` = ok). If any `diff` non-null, retry the step.",
              "",
              "Available device knowledge: 55 schemas — call `device_get_parameters` to see param names + units when tweaking.",
            ].join("\n"),
          },
        },
      ],
    };
  },
};
