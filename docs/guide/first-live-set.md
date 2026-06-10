# Your first Live set

Once the MCP server is connected and the Remote Script is active in Live, start with a small, verifiable build. The best first prompt asks for a musical result and asks the assistant to read the set back.

## 1. Confirm the bridge

Ask your MCP client:

> "Check that ableton-mind can reach Live. Read the session info, list tracks, and tell me the current tempo, scale and track count before changing anything."

The assistant should use `session_get_info` and `track_list`. If it cannot reach Live, go to [Troubleshooting](./troubleshooting).

## 2. Build a small loop

Try:

> "Create a four-track 128 BPM tech-house loop: Kick, Bass, Hats and Chords. Use a 4-bar Session View loop, apply `drums/tech-house-kick`, add a rolling bass pattern, keep everything named clearly, then verify the created tracks and clips."

You should see Live change as the assistant creates tracks and clips. The response should include what was created and what was verified.

## 3. Shape the sound

Then iterate in plain language:

- "Make the bass darker and shorter."
- "Add sidechain pumping from the kick to the bass."
- "Open the filter over 16 bars into the drop."
- "Add a return reverb and keep the kick dry."
- "Snapshot the session and show me the diff since the previous step."

## 4. Use recipe starters

Recipes are useful when you want a known pattern first and a creative pass second:

> "List embedded recipes, then apply `racks/sidechain-rack` to the bass track. After applying it, verify the rack exists and tell me which macro names I should perform."

## 5. Stop when the set is readable

Before you keep building, ask:

> "Audit the set for naming, track order, empty clips and obvious routing mistakes. Do not create anything new unless you find a specific issue; report the fixes first."

That habit keeps AI-generated sessions understandable.
