#!/usr/bin/env node
/**
 * extract-device-schemas.mjs (TD-011 — real parser)
 *
 * Lê `.adv` (XML gzip) dos devices nativos do Live no User Library e gera
 * JSONs em `src/knowledge/devices/_extracted/<device>.json`.
 *
 * `.adv` format: gzip → XML. Cada parameter automatável aparece como
 * `<NomeDoParam><Manual Value="X.YZ"/><MidiCcOnOff.../>...</NomeDoParam>`
 * (tag varia mas Manual+Value é universal). Para Phase 1 extraímos pares
 * `(name, default_value)` — ranges (min/max) e units virão de uma tabela
 * curada por device.
 *
 * Estratégia robusta a 100% dos devices? Não. O `.adv` é um snapshot do
 * estado salvo, não um schema. Para schemas completos seria preciso introspecção
 * via LiveAPI (`device.parameters[i].min/max/name/value`). Phase 2 add isso.
 *
 * Por enquanto: extrai nomes e defaults dos params escritos no `.adv`, marca
 * `source: "extracted-from-default-adv"`, e deixa `min/max/unit` para o
 * curador manual completar.
 *
 * Uso:
 *   node scripts/extract-device-schemas.mjs              # extrai todos
 *   node scripts/extract-device-schemas.mjs --device Wavetable
 *   node scripts/extract-device-schemas.mjs --dry-run
 *   node scripts/extract-device-schemas.mjs --inventory  # só lista, não extrai
 */

import { createHash } from "node:crypto";
import fs from "node:fs/promises";
import os from "node:os";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { gunzipSync } from "node:zlib";

const REPO_ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const OUT_DIR = path.join(REPO_ROOT, "src", "knowledge", "devices", "_extracted");

const args = process.argv.slice(2);
const DRY = args.includes("--dry-run");
const INVENTORY = args.includes("--inventory");
const devIdx = args.indexOf("--device");
const ONLY_DEVICE = devIdx >= 0 ? args[devIdx + 1] : null;

function defaultsRoot() {
  const home = os.homedir();
  switch (process.platform) {
    case "darwin":
      return path.join(home, "Music", "Ableton", "User Library", "Defaults", "Devices");
    case "win32":
      return path.join(home, "Documents", "Ableton", "User Library", "Defaults", "Devices");
    default:
      throw new Error(`Plataforma não suportada: ${process.platform}`);
  }
}

async function walkAdv(dir, out = []) {
  let entries;
  try {
    entries = await fs.readdir(dir, { withFileTypes: true });
  } catch (err) {
    if (err.code === "ENOENT") return out;
    throw err;
  }
  for (const e of entries) {
    const full = path.join(dir, e.name);
    if (e.isDirectory()) {
      await walkAdv(full, out);
    } else if (e.isFile() && e.name.endsWith(".adv")) {
      out.push(full);
    }
  }
  return out;
}

/**
 * Lê e descomprime um `.adv`. Live usa gzip raw (sem container).
 * Retorna string XML.
 */
async function readAdvXml(filePath) {
  const buf = await fs.readFile(filePath);
  // Live's .adv typically starts with gzip magic 0x1f 0x8b.
  if (buf[0] !== 0x1f || buf[1] !== 0x8b) {
    throw new Error(`not a gzip file (no magic header): ${filePath}`);
  }
  const xml = gunzipSync(buf).toString("utf8");
  return xml;
}

/**
 * Parser sax-lite por regex. Extrai pares `(tag_path, manual_value)`.
 *
 * Live encoding: cada parameter aparece como
 *   <ParamName>
 *     <LomId Value="0" />
 *     <Manual Value="100" />
 *     <MidiControllerRange>...</MidiControllerRange>
 *     <AutomationTarget Id="...">
 *       <LockEnvelope Value="0" />
 *     </AutomationTarget>
 *     ...
 *   </ParamName>
 *
 * Heurística: caçamos todas as ocorrências de `<TagName ...> ... <Manual Value="X"/> ... </TagName>`
 * onde TagName não é genérico (LomId, AutomationTarget, etc).
 */
const GENERIC_TAGS = new Set([
  "LomId",
  "AutomationTarget",
  "ModulationTarget",
  "MidiControllerRange",
  "MpeSettings",
  "MidiCcOnOff",
  "MidiKeyRange",
  "Manual",
  "LockEnvelope",
  "MidiController",
  "Min",
  "Max",
  "ValueType",
]);

/**
 * Encontra blocos `<X>...</X>` que contêm exatamente um `<Manual Value="...">`.
 * Retorna `[{ name: "X", default: 0.5 }, ...]`. Best-effort.
 */
function extractParams(xml) {
  const params = [];
  const seen = new Set();
  // Regex matches `<TagName>...</TagName>` (não self-closing) num único nivel
  // simplificado — usa lazy matching.
  const blockRe = /<([A-Z][A-Za-z0-9_]*)>([\s\S]*?)<\/\1>/g;
  let m;
  while ((m = blockRe.exec(xml)) !== null) {
    const tag = m[1];
    const inner = m[2];
    if (GENERIC_TAGS.has(tag)) continue;
    if (seen.has(tag)) continue;
    // procura `<Manual Value="X" />` apenas em primeiro nível (heurística:
    // não pular nested blocks complicados — Live tipicamente coloca Manual
    // como first-level child do param).
    const mm = inner.match(/<Manual\s+Value="([^"]+)"\s*\/>/);
    if (!mm) continue;
    const valStr = mm[1];
    let val;
    if (valStr === "true") val = 1;
    else if (valStr === "false") val = 0;
    else {
      val = Number(valStr);
      if (Number.isNaN(val)) continue;
    }
    params.push({ name: tag, default: val });
    seen.add(tag);
  }
  return params;
}

function deviceIdFromFile(filePath, defaultsRootDir) {
  const rel = path.relative(defaultsRootDir, filePath);
  const cat = path.dirname(rel).replace(/\\/g, "/").toLowerCase();
  const dev = path.basename(rel, ".adv");
  return { category: cat, deviceName: dev, id: `ableton.${dev.toLowerCase().replace(/[^a-z0-9]/g, "_")}` };
}

async function extractOne(filePath, defaultsRootDir) {
  const xml = await readAdvXml(filePath);
  const params = extractParams(xml);
  const { category, deviceName, id } = deviceIdFromFile(filePath, defaultsRootDir);
  const hash = createHash("sha256").update(xml).digest("hex").slice(0, 8);
  return {
    $schema: "../../device-schema.json",
    id,
    name: deviceName,
    category: categoryFromPath(category),
    vendor: "Ableton",
    live_version_min: "10.0",
    source: `extracted-from-default-adv (sha256:${hash})`,
    completeness: "partial",
    parameters: params.map((p, i) => ({
      index: i,
      name: p.name,
      min: 0,
      max: 1,
      default: p.default,
      automatable: true,
      description: "(extracted from Default.adv — min/max/unit pending curation)",
    })),
    todo: ["Curador: revisar min/max/unit", "Adicionar params não-automatáveis"],
  };
}

function categoryFromPath(cat) {
  if (cat.includes("instrument") || cat.includes("drum")) return "instrument";
  if (cat.includes("midi")) return "midi_effect";
  if (cat.includes("audio") || cat.includes("effect")) return "audio_effect";
  if (cat.includes("rack")) return "rack";
  return "audio_effect";
}

function printInventory(root, files) {
  console.log(`\n${files.length} arquivos .adv:\n`);
  for (const f of files) {
    console.log(`  ${path.relative(root, f)}`);
  }
}

async function extractAll(filtered, root) {
  let written = 0;
  for (const f of filtered) {
    let schema;
    try {
      schema = await extractOne(f, root);
    } catch (err) {
      console.warn(`⚠ ${path.relative(root, f)}: ${err.message}`);
      continue;
    }
    const outName = `${schema.id.replace(/^ableton\./, "")}.json`;
    const outPath = path.join(OUT_DIR, outName);
    if (DRY) {
      console.log(`(dry-run) extracted ${schema.parameters.length} params from ${path.basename(f)} → ${outName}`);
    } else {
      await fs.writeFile(outPath, `${JSON.stringify(schema, null, 2)}\n`);
      console.log(`✓ ${outName} (${schema.parameters.length} params)`);
      written += 1;
    }
  }
  return written;
}

async function main() {
  const root = defaultsRoot();
  console.log(`Defaults root: ${root}`);
  const files = await walkAdv(root);
  if (files.length === 0) {
    console.log("(nenhum .adv encontrado — `Save as Default Preset` no Live para gerar)");
    return;
  }
  if (INVENTORY) {
    printInventory(root, files);
    return;
  }

  const filtered = ONLY_DEVICE
    ? files.filter((f) => path.basename(f, ".adv").toLowerCase() === ONLY_DEVICE.toLowerCase())
    : files;

  if (filtered.length === 0) {
    console.error(`✗ device "${ONLY_DEVICE}" não encontrado nos .adv disponíveis.`);
    process.exit(1);
  }

  if (!DRY) {
    await fs.mkdir(OUT_DIR, { recursive: true });
  }

  const written = await extractAll(filtered, root);

  if (!DRY) {
    console.log(`\n${written} arquivos escritos em ${path.relative(REPO_ROOT, OUT_DIR)}/`);
    console.log("Próximo passo: curador revisa min/max/unit e move para `src/knowledge/devices/`.");
  }
}

main().catch((err) => {
  console.error("✗", err.stack ?? err.message);
  process.exit(1);
});
