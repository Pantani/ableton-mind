#!/usr/bin/env node
/**
 * build-dxt.mjs
 *
 * Empacota o ableton-mind num `.mcpb` (MCP Bundle) para Claude Desktop one-click install.
 *
 * Estrutura do .mcpb (zip):
 *   manifest.json                ← dxt/manifest.json
 *   dist/                        ← saída do tsup
 *   src/knowledge/               ← devices, scales (embedded)
 *   README.md
 *   LICENSE
 *
 * Uso:
 *   node scripts/build-dxt.mjs                    # gera build/ableton-mind-<ver>.mcpb
 *   node scripts/build-dxt.mjs --out path/x.mcpb  # path custom
 *   node scripts/build-dxt.mjs --check            # só valida pré-requisitos
 *
 * Pré-requisitos:
 *   - `npm run build` rodado (existe `dist/index.js`).
 *   - `dxt/manifest.json` existe.
 *   - `node --version` >= 20.
 *
 * Implementação: usa `node:zlib` + walker simples para gerar ZIP central directory
 * conforme APPNOTE.TXT (PKZIP). Sem deps externas — o pacote npm fica leve.
 */

import { createHash } from "node:crypto";
import { createWriteStream } from "node:fs";
import fs from "node:fs/promises";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { deflateRawSync } from "node:zlib";

const REPO_ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");

const args = process.argv.slice(2);
const CHECK_ONLY = args.includes("--check");
const outArgIdx = args.indexOf("--out");
const OUT_OVERRIDE = outArgIdx >= 0 ? args[outArgIdx + 1] : null;

async function loadManifest() {
  const p = path.join(REPO_ROOT, "dxt", "manifest.json");
  const raw = await fs.readFile(p, "utf8");
  return { manifest: JSON.parse(raw), path: p };
}

async function loadPackageJson() {
  const p = path.join(REPO_ROOT, "package.json");
  const raw = await fs.readFile(p, "utf8");
  return JSON.parse(raw);
}

async function pathExists(p) {
  try {
    await fs.access(p);
    return true;
  } catch {
    return false;
  }
}

async function walkFiles(dir, baseRel = "") {
  const out = [];
  let entries;
  try {
    entries = await fs.readdir(dir, { withFileTypes: true });
  } catch (err) {
    if (err.code === "ENOENT") return out;
    throw err;
  }
  for (const e of entries) {
    const full = path.join(dir, e.name);
    const rel = baseRel ? `${baseRel}/${e.name}` : e.name;
    if (e.isDirectory()) {
      const inner = await walkFiles(full, rel);
      out.push(...inner);
    } else if (e.isFile()) {
      out.push({ rel, full });
    }
  }
  return out;
}

// --- Minimal ZIP writer (deflate-raw, no encryption, no zip64) ----------------
// Conforme PKZIP APPNOTE.TXT.

function crc32(buf) {
  // Tabela CRC32 cacheada.
  if (!crc32._table) {
    const table = new Uint32Array(256);
    for (let n = 0; n < 256; n++) {
      let c = n;
      for (let k = 0; k < 8; k++) c = c & 1 ? 0xedb88320 ^ (c >>> 1) : c >>> 1;
      table[n] = c >>> 0;
    }
    crc32._table = table;
  }
  let c = 0xffffffff;
  for (let i = 0; i < buf.length; i++) c = (c >>> 8) ^ crc32._table[(c ^ buf[i]) & 0xff];
  return (c ^ 0xffffffff) >>> 0;
}

function dosTime(date = new Date(2026, 5, 9, 12, 0, 0)) {
  // Z deterministic (sem Date.now() — workflows reproducible)
  const seconds = Math.floor(date.getSeconds() / 2);
  const time = (date.getHours() << 11) | (date.getMinutes() << 5) | seconds;
  const dateVal = ((date.getFullYear() - 1980) << 9) | ((date.getMonth() + 1) << 5) | date.getDate();
  return { time, date: dateVal };
}

function buildZip(entries) {
  // entries: [{ rel, data: Buffer }]
  const localChunks = [];
  const centralChunks = [];
  let offset = 0;
  const { time, date } = dosTime();

  for (const e of entries) {
    const nameBuf = Buffer.from(e.rel, "utf8");
    const compressed = deflateRawSync(e.data, { level: 9 });
    const crc = crc32(e.data);

    // Local file header (30 bytes + name + extra)
    const local = Buffer.alloc(30);
    local.writeUInt32LE(0x04034b50, 0); // signature
    local.writeUInt16LE(20, 4); // version needed
    local.writeUInt16LE(0, 6); // flags
    local.writeUInt16LE(8, 8); // method = deflate
    local.writeUInt16LE(time, 10);
    local.writeUInt16LE(date, 12);
    local.writeUInt32LE(crc, 14);
    local.writeUInt32LE(compressed.length, 18);
    local.writeUInt32LE(e.data.length, 22);
    local.writeUInt16LE(nameBuf.length, 26);
    local.writeUInt16LE(0, 28); // extra len

    localChunks.push(local, nameBuf, compressed);

    // Central directory entry (46 bytes + name + extra + comment)
    const central = Buffer.alloc(46);
    central.writeUInt32LE(0x02014b50, 0); // signature
    central.writeUInt16LE(20, 4); // version made by
    central.writeUInt16LE(20, 6); // version needed
    central.writeUInt16LE(0, 8);
    central.writeUInt16LE(8, 10);
    central.writeUInt16LE(time, 12);
    central.writeUInt16LE(date, 14);
    central.writeUInt32LE(crc, 16);
    central.writeUInt32LE(compressed.length, 20);
    central.writeUInt32LE(e.data.length, 24);
    central.writeUInt16LE(nameBuf.length, 28);
    central.writeUInt16LE(0, 30); // extra
    central.writeUInt16LE(0, 32); // comment
    central.writeUInt16LE(0, 34); // disk
    central.writeUInt16LE(0, 36); // int attr
    central.writeUInt32LE(0, 38); // ext attr
    central.writeUInt32LE(offset, 42); // offset of local header

    centralChunks.push(central, nameBuf);

    offset += 30 + nameBuf.length + compressed.length;
  }

  const localSection = Buffer.concat(localChunks);
  const centralSection = Buffer.concat(centralChunks);

  // End of central directory record
  const eocd = Buffer.alloc(22);
  eocd.writeUInt32LE(0x06054b50, 0);
  eocd.writeUInt16LE(0, 4); // disk
  eocd.writeUInt16LE(0, 6); // disk with cd start
  eocd.writeUInt16LE(entries.length, 8);
  eocd.writeUInt16LE(entries.length, 10);
  eocd.writeUInt32LE(centralSection.length, 12);
  eocd.writeUInt32LE(localSection.length, 16);
  eocd.writeUInt16LE(0, 20); // comment len

  return Buffer.concat([localSection, centralSection, eocd]);
}

async function gatherEntries() {
  const entries = [];

  async function add(rel, full) {
    const data = await fs.readFile(full);
    entries.push({ rel, data });
  }

  async function addDir(srcDir, prefix) {
    const files = await walkFiles(srcDir);
    for (const f of files) {
      const data = await fs.readFile(f.full);
      entries.push({ rel: `${prefix}/${f.rel}`, data });
    }
  }

  // manifest na raiz do .mcpb
  await add("manifest.json", path.join(REPO_ROOT, "dxt", "manifest.json"));

  // dist (saída do tsup)
  await addDir(path.join(REPO_ROOT, "dist"), "dist");

  // knowledge embedded (JSONs estáticos)
  await addDir(path.join(REPO_ROOT, "src", "knowledge"), "knowledge");

  // README + LICENSE
  await add("README.md", path.join(REPO_ROOT, "README.md"));
  await add("LICENSE", path.join(REPO_ROOT, "LICENSE"));

  return entries;
}

async function main() {
  const { manifest } = await loadManifest();
  const pkg = await loadPackageJson();
  if (manifest.version !== pkg.version) {
    console.warn(`⚠ versão manifest (${manifest.version}) != package.json (${pkg.version})`);
  }

  const distIndex = path.join(REPO_ROOT, "dist", "index.js");
  const hasDist = await pathExists(distIndex);

  console.log(`name:     ${manifest.name}`);
  console.log(`version:  ${manifest.version}`);
  console.log(`dist/:    ${hasDist ? "✓" : "✗ FALTA — rode `npm run build`"}`);
  console.log(`manifest: dxt/manifest.json`);

  if (!hasDist) {
    if (CHECK_ONLY) {
      process.exit(1);
    }
    console.error("\n✗ dist/index.js não encontrado. Rode `npm run build` antes.");
    process.exit(1);
  }

  if (CHECK_ONLY) {
    console.log("\n✓ pré-requisitos OK.");
    return;
  }

  const entries = await gatherEntries();
  const zip = buildZip(entries);
  const hash = createHash("sha256").update(zip).digest("hex").slice(0, 12);

  const outDir = path.join(REPO_ROOT, "build");
  await fs.mkdir(outDir, { recursive: true });
  const outPath =
    OUT_OVERRIDE ?? path.join(outDir, `${manifest.name}-${manifest.version}.mcpb`);

  await fs.writeFile(outPath, zip);
  const stat = await fs.stat(outPath);
  console.log(`\n✓ ${outPath}`);
  console.log(`  entries: ${entries.length}`);
  console.log(`  size:    ${(stat.size / 1024).toFixed(1)} KB`);
  console.log(`  sha256:  ${hash}…`);
  console.log(`\nInstale arrastando para o Claude Desktop ou via 'mcpb install ${outPath}'.`);
}

main().catch((err) => {
  console.error("✗", err.stack ?? err.message);
  process.exit(1);
});
