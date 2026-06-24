#!/usr/bin/env node
// Sync version from package.json into:
//   - dxt/manifest.json
//   - server.json (top-level + packages[].version)
//   - safeskill.manifest.json
//   - .claude-plugin/marketplace.json
//   - plugins/ableton-mind/.claude-plugin/plugin.json
//
// Invoked by the npm `version` lifecycle (see package.json), so `npm version
// patch` rewrites the satellite manifests before tagging.

import { readFileSync, writeFileSync } from "node:fs";
import { dirname, resolve } from "node:path";
import { fileURLToPath } from "node:url";

const here = dirname(fileURLToPath(import.meta.url));
const root = resolve(here, "..");

const pkg = JSON.parse(readFileSync(resolve(root, "package.json"), "utf8"));
const version = pkg.version;
if (!version) {
  console.error("::error::package.json has no version");
  process.exit(1);
}

function patch(file, mutator) {
  const path = resolve(root, file);
  const json = JSON.parse(readFileSync(path, "utf8"));
  mutator(json);
  writeFileSync(path, `${JSON.stringify(json, null, 2)}\n`);
  console.log(`synced ${file} → ${version}`);
}

patch("dxt/manifest.json", (m) => {
  m.version = version;
});
patch("server.json", (m) => {
  m.version = version;
  if (Array.isArray(m.packages) && m.packages[0]) {
    m.packages[0].version = version;
  }
});
patch("safeskill.manifest.json", (m) => {
  m.version = version;
});
patch(".claude-plugin/marketplace.json", (m) => {
  m.version = version;
  if (Array.isArray(m.plugins)) {
    for (const plugin of m.plugins) {
      if (plugin?.name === "ableton-mind") {
        plugin.version = version;
      }
    }
  }
});
patch("plugins/ableton-mind/.claude-plugin/plugin.json", (m) => {
  m.version = version;
  const server = m.mcpServers?.["ableton-mind"];
  if (server && Array.isArray(server.args)) {
    server.args = server.args.map((arg) =>
      typeof arg === "string" && arg.startsWith("ableton-mind@")
        ? `ableton-mind@${version}`
        : arg,
    );
  }
});
