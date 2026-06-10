---
name: device-schema-extraction
description: How to extract, complete and validate Ableton Live native device JSON schemas for the ableton-mind knowledge base.
---

# Device Schema Extraction

Use this skill when populating src/knowledge/devices, indexing packs or changing scripts/extract-device-schemas.mjs.

## Sources

- Bridge introspection of device.parameters for name, min, max, default and automation flags.
- Default.adv parsing for saved default state.
- Ableton manuals and LOM docs for behavior notes.
- Manual curation for units, nonlinear curves, macro targets and useful descriptions.

## Workflow

1. Extract or introspect raw parameters.
2. Normalize slug, id, category, vendor and Live version metadata.
3. Fill min, max, default, unit, automatable, modulatable and concise description.
4. Mark source and completeness.
5. Validate uniqueness of ids, names and indexes.
6. Run recipe and tool checks that depend on the schema.

## Quality Rules

Descriptions must be short, English and useful to an LLM. Do not invent ranges. Use unit=curve for nonlinear 0..1 controls and explain audible behavior. Keep runtime-discoverable facts out of static knowledge unless they are slow-changing and useful.
