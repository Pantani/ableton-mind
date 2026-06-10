#!/usr/bin/env node
/**
 * install-remote-script.mjs
 *
 * Creates a symlink from `live/AbletonMind/` to Ableton Live's Remote Scripts
 * directory in the User Library. Dev mode: edit here, Live loads from there.
 *
 *   macOS:   ~/Music/Ableton/User Library/Remote Scripts/AbletonMind
 *   Windows: %USERPROFILE%/Documents/Ableton/User Library/Remote Scripts/AbletonMind
 *
 * Usage:
 *   node scripts/install-remote-script.mjs           # create/update symlink
 *   node scripts/install-remote-script.mjs --copy    # copy instead of symlink (CI, snapshot)
 *   node scripts/install-remote-script.mjs --check   # only report status, do not mutate
 *
 * The script does not touch other existing Remote Scripts. If AbletonMind is
 * already installed, it refuses to overwrite unless `--force` is passed.
 */

import { execSync } from "node:child_process";
import fs from "node:fs";
import os from "node:os";
import path from "node:path";

const REPO_ROOT = path.resolve(path.dirname(new URL(import.meta.url).pathname), "..");
const SRC = path.join(REPO_ROOT, "live", "AbletonMind");

const args = new Set(process.argv.slice(2));
const MODE = args.has("--copy") ? "copy" : "symlink";
const FORCE = args.has("--force");
const CHECK_ONLY = args.has("--check");

function targetDir() {
  const home = os.homedir();
  switch (process.platform) {
    case "darwin":
      return path.join(home, "Music", "Ableton", "User Library", "Remote Scripts", "AbletonMind");
    case "win32":
      return path.join(home, "Documents", "Ableton", "User Library", "Remote Scripts", "AbletonMind");
    case "linux":
      throw new Error("Ableton Live does not run natively on Linux. Consider Wine/Bottles.");
    default:
      throw new Error(`Unsupported platform: ${process.platform}`);
  }
}

function ensureSourceExists() {
  if (!fs.existsSync(SRC)) {
    throw new Error(`Source not found: ${SRC}. Did you run this from the repo root?`);
  }
}

function describe(p) {
  if (!fs.existsSync(p)) return "MISSING";
  const st = fs.lstatSync(p);
  if (st.isSymbolicLink()) return `symlink → ${fs.readlinkSync(p)}`;
  if (st.isDirectory()) return `directory (copy)`;
  return `file (unexpected)`;
}

function main() {
  ensureSourceExists();
  const target = targetDir();
  console.log(`source: ${SRC}`);
  console.log(`target: ${target}`);
  console.log(`current status: ${describe(target)}`);

  if (CHECK_ONLY) {
    process.exit(0);
  }

  if (fs.existsSync(target) && !FORCE) {
    console.error(
      `\n✗ ${target} already exists. Use --force to overwrite.`,
    );
    process.exit(1);
  }

  fs.mkdirSync(path.dirname(target), { recursive: true });

  if (fs.existsSync(target)) {
    const st = fs.lstatSync(target);
    if (st.isSymbolicLink() || st.isFile()) fs.unlinkSync(target);
    else fs.rmSync(target, { recursive: true, force: true });
  }

  if (MODE === "symlink") {
    fs.symlinkSync(SRC, target, "dir");
    console.log(`\n✓ symlink created.`);
  } else {
    // Recursive copy via cp -R (simpler than a JS walker here).
    execSync(`cp -R "${SRC}" "${target}"`, { stdio: "inherit" });
    console.log(`\n✓ copy created.`);
  }

  console.log(
    `\nNext step: open Live -> Preferences -> Link/Tempo/MIDI -> Control Surface -> choose AbletonMind.`,
  );
}

main();
