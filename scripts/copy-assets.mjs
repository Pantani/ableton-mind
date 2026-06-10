#!/usr/bin/env node
// Copy runtime assets next to the compiled dist/index.js so that:
//   - knowledge loader (KNOWLEDGE_DIR = dirname(import.meta.url) = dist/)
//     finds dist/devices/*.json, dist/scales.json and dist/discovery.json.
//   - recipes loader finds dist/recipes/**.
//
// Runs as a postbuild step (see package.json `build` script). Without this,
// the published npm package would only contain dist/index.js — empty recipes
// and missing device schemas at runtime.

import { cp, mkdir } from "node:fs/promises";
import { dirname, resolve } from "node:path";
import { fileURLToPath } from "node:url";

const here = dirname(fileURLToPath(import.meta.url));
const root = resolve(here, "..");
const dist = resolve(root, "dist");

await mkdir(dist, { recursive: true });

async function copyDir(src, dest) {
  await cp(resolve(root, src), resolve(dist, dest), { recursive: true });
  console.log(`copied ${src} → dist/${dest}`);
}

async function copyFile(src, dest) {
  await cp(resolve(root, src), resolve(dist, dest));
  console.log(`copied ${src} → dist/${dest}`);
}

await copyDir("src/knowledge/devices", "devices");
await copyFile("src/knowledge/scales.json", "scales.json");
await copyFile("src/knowledge/discovery.json", "discovery.json");
await copyDir("recipes", "recipes");
