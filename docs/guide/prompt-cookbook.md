# Prompt cookbook

Copy these prompts, change the details, and make them yours. Good prompts describe the musical result, constraints and verification you expect. You do not need to name every tool, but naming a recipe is useful when you want a known starting point.

## How to phrase it

Use this shape:

> "Create [musical result] at [tempo/key] with [tracks/devices/arrangement]. Use existing recipes where they fit. Read the Live set first, keep names clear, and verify the final state with a snapshot/diff."

Ask for verification every time a prompt mutates the set. That is the main difference between a useful Live assistant and a text generator.

## Recipe starters

These start from embedded JSON recipes, then ask for a creative pass.

> "List the embedded drum recipes, apply `drums/tech-house-kick`, set the tempo to 128 BPM, name the track `Kick - Tech House`, and verify the clip length and track name."

A clean four-on-the-floor kick starter for house and techno work.

> "Apply `drums/jungle-break` at 170 BPM, then add a second clip variation with fewer snares and more ghost-note feel. Verify both clip names and lengths."

A DnB/jungle sketch that starts with the known break recipe and adds a variation.

> "Apply `drums/lofi-kit`, then create a dusty 90 BPM two-bar beat with low velocity variation. Add `Vinyl Distortion` lightly if the device schema is available, then verify the device and clip."

A lo-fi beat prompt that asks the assistant to use the knowledge base before touching device parameters.

> "Apply `bass/reese` and make it dark, detuned and controlled. Keep the bass in the low register, add a 4-bar MIDI clip, and verify note range before playback."

A Reese bass foundation for DnB, neurofunk or dark electronic sketches.

> "Apply `bass/sub-808`, write an eight-bar trap pattern in F minor, leave space for the kick, and verify that the notes stay below C3."

A sub-bass starter with an explicit register constraint.

> "Apply `chords/neo-soul-progressions`, set the key to D minor, use extended voicings, and create a second clip with a sparser turnaround."

A harmony-first prompt for songwriting sessions.

> "Apply `chords/lofi-jazz`, make the chord track warm and slightly filtered, then add a short top melody on a separate MIDI track."

A sketch prompt for lo-fi hip-hop and beat-making.

## Full track sketches

> "Create a 128 BPM tech-house starter with Kick, Bass, Hats, Percussion and Chords. Use `drums/tech-house-kick`, `bass/reese` only if it fits after lowering the intensity, and `racks/sidechain-rack` on the bass. Verify track order, clip lengths and tempo."

Good for a dance-music first draft where structure matters more than individual sound design.

> "Create a late-night lo-fi loop at 86 BPM: dusty drums, jazz chords, sub bass, a vinyl-style noise layer and a short melodic hook. Use `drums/lofi-kit`, `chords/lofi-jazz` and `mixing/master-bus`, then snapshot the set."

Uses multiple recipes but keeps the musical ask clear.

> "Build a 170 BPM jungle idea: breakbeat, Reese bass, one atmospheric pad and a 16-bar arrangement marker plan. Keep the first version simple and tell me what to audition manually."

Useful when you want Live populated quickly without over-producing the first pass.

> "Make an eight-bar ambient techno bed: muted kick, evolving Drift pad, filtered noise, delay return and slow filter automation. Read the available device schemas before setting parameters."

This prompt prioritizes schema-aware sound design.

## Sound design

> "Create a MIDI track named `Drift Pad`, load Drift if available, make a warm poly pad, then verify the exact device parameter names before setting filter, envelope and LFO values."

The important part is the instruction to inspect parameter names first.

> "On the bass track, add Roar and EQ Eight. Keep the sub clean, add midrange grit, and report every parameter you changed by name."

Good for controlled destructive sound design because it leaves an audit trail.

> "Make a vocal-chop instrument from a Simpler-style track. Keep the prompt non-destructive: duplicate or create a new track before editing, then verify the original track was not changed."

Use this shape when source material matters.

## Arrangement and automation

> "Apply `arrangements/tech-house-7min` as a planning scaffold. Create locators or scene names for intro, first drop, break, second drop and outro, then verify the section names."

A planning prompt before committing to detailed clips.

> "Write a 16-bar filter opening on the chord track. Use automation points rather than static parameter changes, then read the envelope back and summarize the curve."

For automation, always ask the assistant to read the envelope back.

> "Turn this four-bar loop into a 32-bar performance sketch: duplicate the core clips into sections, mute elements for the intro, bring bass in after 8 bars, and verify no empty scene is fired."

Good for moving from loop to arrangement without a full seven-minute structure.

## Mixing and performance

> "Apply `mixing/bass-glue` to the bass group, keep peak level conservative, and verify the changed devices before playing."

> "Apply `mixing/vocal-chain` to the vocal track, but first snapshot the current track devices. After applying it, report the before/after device list."

> "Apply `mixing/master-bus` lightly for monitoring only. Do not over-limit; set a conservative ceiling and verify the master device chain."

> "Apply `live_performance/launchpad-rig`, create clear scene names for A/B/C sections, and verify clip launch state without starting playback."

## Developer and QA prompts

These are for working on ableton-mind itself or checking a session with more precision.

> "Read `live://session/state`, list all tracks and clips, then call `session_snapshot`. Do not mutate Live. Summarize missing names, empty clips and unexpected track types."

> "Use `list_resources` and `list_prompts` to show what this server exposes. Then explain which resource or prompt would help build a house loop."

> "Use `list_recipes` filtered by `mixing`, pick the safest recipe for a rough master bus, and explain why before calling `apply_recipe`."

> "Before changing any device parameter, call `device_get_parameters` for the target device and only set parameters whose names are present in the schema."

> "Run a create -> verify -> diff loop: snapshot the set, make the smallest requested change, snapshot again, and explain the diff in plain language."

## Repair prompts

> "Audit the current set for AI-created clutter: duplicate track names, empty MIDI clips, unverified devices and tracks with no clips. Ask before deleting anything."

> "Something changed but I do not know what. Compare the latest snapshot with a fresh `session_snapshot` and summarize only the real differences."

> "The bridge seems disconnected. Check Live reachability, timeout settings and Remote Script activation. Do not reinstall until you have reported which check failed."
