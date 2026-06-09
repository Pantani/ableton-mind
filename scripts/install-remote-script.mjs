#!/usr/bin/env node
/**
 * install-remote-script.mjs
 *
 * Cria um symlink de `live/AbletonMind/` para o diretório de Remote Scripts do
 * Ableton Live no User Library. Modo dev: edita aqui, Live carrega de lá.
 *
 *   macOS:   ~/Music/Ableton/User Library/Remote Scripts/AbletonMind
 *   Windows: %USERPROFILE%/Documents/Ableton/User Library/Remote Scripts/AbletonMind
 *
 * Uso:
 *   node scripts/install-remote-script.mjs           # cria/atualiza symlink
 *   node scripts/install-remote-script.mjs --copy    # copia ao invés de symlink (CI, snapshot)
 *   node scripts/install-remote-script.mjs --check   # só reporta o estado, não muta
 *
 * O script não toca em outros Remote Scripts existentes. Se já houver um
 * AbletonMind instalado, ele recusa a sobrescrever a não ser que `--force`
 * seja passado.
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
      throw new Error("Ableton Live não roda nativamente em Linux. Considere Wine/Bottles.");
    default:
      throw new Error(`Plataforma não suportada: ${process.platform}`);
  }
}

function ensureSourceExists() {
  if (!fs.existsSync(SRC)) {
    throw new Error(`Source não encontrado: ${SRC}. Você rodou na raiz do repo?`);
  }
}

function describe(p) {
  if (!fs.existsSync(p)) return "AUSENTE";
  const st = fs.lstatSync(p);
  if (st.isSymbolicLink()) return `symlink → ${fs.readlinkSync(p)}`;
  if (st.isDirectory()) return `diretório (cópia)`;
  return `arquivo (?? inesperado)`;
}

function main() {
  ensureSourceExists();
  const target = targetDir();
  console.log(`source: ${SRC}`);
  console.log(`target: ${target}`);
  console.log(`status atual: ${describe(target)}`);

  if (CHECK_ONLY) {
    process.exit(0);
  }

  if (fs.existsSync(target) && !FORCE) {
    console.error(
      `\n✗ ${target} já existe. Use --force para sobrescrever.`,
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
    console.log(`\n✓ symlink criado.`);
  } else {
    // Cópia recursiva via cp -R (mais simples que walker em JS).
    execSync(`cp -R "${SRC}" "${target}"`, { stdio: "inherit" });
    console.log(`\n✓ cópia criada.`);
  }

  console.log(
    `\nPróximo passo: abra o Live → Preferences → Link/Tempo/MIDI → Control Surface → escolha AbletonMind.`,
  );
}

main();
