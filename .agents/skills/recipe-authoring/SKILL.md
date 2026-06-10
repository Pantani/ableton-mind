---
name: recipe-authoring
description: How to author ableton-mind JSON music recipes for drums, bass, chords, racks, arrangements, mixing and live performance.
---

# Recipe Authoring

Use this skill when creating or reviewing files under recipes/.

## What Makes a Good Recipe

A recipe is declarative JSON that creates a musically useful result in Live. It should sound recognizable for its genre, be reusable, be override-friendly and verify its own output.

## Required Shape

- id, title, description, category and tags.
- params for tempo, key, length_bars, intensity or relevant user choices.
- steps with tool names, inputs, optional let bindings and refs.
- verify checks for expected tracks, devices, clips or arrangement state.

## Variables and Refs

Use named step results, top-level params, $next for the next free index and $last for the previous result. Recipes are data, not code; do not add imperative JS logic.

## Workflow

1. Pick 2-3 references for the genre or technique.
2. Draft the smallest useful JSON.
3. Check every URI and device parameter against knowledge.
4. Apply in Live or a faithful mock.
5. Listen and adjust until it works musically.
6. Test variations in tempo, key and intensity.
7. Keep descriptions in English; localized docs belong under docs/pt.

## Anti-Patterns

Avoid generic all-purpose recipes, uncataloged URIs, hidden hardcoded assumptions, ignored intensity params and recipes that were never auditioned.
