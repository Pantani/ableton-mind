/**
 * ableton-mind doctor — diagnostico de instalação.
 *
 * Checks:
 *  - Node >= 20
 *  - Remote Script symlink/cópia em ~/Music/Ableton/User Library/Remote Scripts/AbletonMind
 *  - Porta 9876 escutando (= Live carregou o script)
 *  - dist/ buildado (build:dxt-ready)
 *  - Knowledge base válida (carrega todos os devices)
 *  - Recipes válidas (carrega todas)
 *
 * Phase 7. Uso: `npx ableton-mind-doctor` ou `node dist/cli/doctor.js`.
 */

import { existsSync, readFileSync, statSync } from "node:fs";
import net from "node:net";
import os from "node:os";
import path from "node:path";
import { fileURLToPath } from "node:url";

import { loadAllDevices } from "../knowledge/index.js";
import { allPrompts } from "../prompts/index.js";
import { listRecipes } from "../recipes/index.js";
import { allResources } from "../resources/index.js";
import { allTools } from "../tools/index.js";

interface Check {
  name: string;
  ok: boolean;
  detail?: string;
  hint?: string;
}

const RESET = "\x1b[0m";
const GREEN = "\x1b[32m";
const RED = "\x1b[31m";
const YELLOW = "\x1b[33m";
const DIM = "\x1b[2m";

function fmt(check: Check): string {
  const mark = check.ok ? `${GREEN}✓${RESET}` : `${RED}✗${RESET}`;
  const detail = check.detail ? ` ${DIM}${check.detail}${RESET}` : "";
  const hint = !check.ok && check.hint ? `\n    ${YELLOW}→${RESET} ${check.hint}` : "";
  return `${mark} ${check.name}${detail}${hint}`;
}

async function checkNode(): Promise<Check> {
  const major = Number.parseInt(process.versions.node.split(".")[0] ?? "0", 10);
  return {
    name: "Node.js >= 20",
    ok: major >= 20,
    detail: `v${process.versions.node}`,
    hint: "Atualize Node para 20+: https://nodejs.org",
  };
}

async function checkRemoteScript(): Promise<Check> {
  const home = os.homedir();
  const paths = {
    darwin: path.join(home, "Music", "Ableton", "User Library", "Remote Scripts", "AbletonMind"),
    win32: path.join(home, "Documents", "Ableton", "User Library", "Remote Scripts", "AbletonMind"),
  } as Record<string, string>;
  const target = paths[process.platform];
  if (!target) {
    return {
      name: "Remote Script instalado",
      ok: false,
      detail: `Plataforma ${process.platform} não suportada`,
    };
  }
  const exists = existsSync(target);
  let detail = "ausente";
  if (exists) {
    const st = statSync(target);
    detail = st.isSymbolicLink() ? "symlink (dev)" : "cópia";
  }
  return {
    name: "Remote Script instalado",
    ok: exists,
    detail,
    hint: "Rode `node scripts/install-remote-script.mjs` na raiz do repo.",
  };
}

async function checkBridgePort(): Promise<Check> {
  const host = process.env.ABLETON_MIND_HOST ?? "127.0.0.1";
  const port = Number(process.env.ABLETON_MIND_PORT ?? 9876);
  return await new Promise<Check>((resolve) => {
    const sock = net.createConnection({ host, port });
    const timer = setTimeout(() => {
      sock.destroy();
      resolve({
        name: `Bridge em ${host}:${port}`,
        ok: false,
        detail: "timeout",
        hint: "Abra o Live e ative AbletonMind em Preferences → Link/Tempo/MIDI → Control Surface.",
      });
    }, 1500);
    sock.once("connect", () => {
      clearTimeout(timer);
      sock.end();
      resolve({ name: `Bridge em ${host}:${port}`, ok: true, detail: "respondendo" });
    });
    sock.once("error", (err) => {
      clearTimeout(timer);
      resolve({
        name: `Bridge em ${host}:${port}`,
        ok: false,
        detail: err.message,
        hint: "Live aberto? Control Surface AbletonMind selecionado?",
      });
    });
  });
}

async function checkKnowledge(): Promise<Check> {
  try {
    const devices = await loadAllDevices();
    return {
      name: "Knowledge base",
      ok: true,
      detail: `${devices.length} devices carregados`,
    };
  } catch (err) {
    return {
      name: "Knowledge base",
      ok: false,
      detail: (err as Error).message,
      hint: "Algum JSON em src/knowledge/devices/ está inválido.",
    };
  }
}

/**
 * TD-039: Doctor confirma que `package.json::version` == `dxt/manifest.json::version`.
 * ADR-0009 exige que essas versões marchem para release ser válido.
 *
 * Em runtime instalado (npm i -g), `dxt/manifest.json` pode não estar
 * empacotado — nesse caso, marcamos como `ok: true` com detail "skip
 * (manifest not bundled)" para não quebrar usuários.
 */
async function checkVersionSync(): Promise<Check> {
  try {
    const here = path.dirname(fileURLToPath(import.meta.url));
    // src/cli/doctor.ts and dist/cli/doctor.js both resolve to repo root via ../..
    // when run from a source checkout or a published npm package.
    const repoRoot = path.resolve(here, "..", "..");
    const pkgPath = path.join(repoRoot, "package.json");
    const dxtPath = path.join(repoRoot, "dxt", "manifest.json");
    if (!existsSync(pkgPath)) {
      return {
        name: "Version sync (pkg ↔ DXT)",
        ok: true,
        detail: "skip (package.json não encontrado)",
      };
    }
    const pkg = JSON.parse(readFileSync(pkgPath, "utf8")) as { version?: string };
    if (!existsSync(dxtPath)) {
      return {
        name: "Version sync (pkg ↔ DXT)",
        ok: true,
        detail: `skip (dxt/manifest.json ausente, pkg=${pkg.version ?? "?"})`,
      };
    }
    const dxt = JSON.parse(readFileSync(dxtPath, "utf8")) as { version?: string };
    const ok = pkg.version === dxt.version;
    return {
      name: "Version sync (pkg ↔ DXT)",
      ok,
      detail: ok ? `v${pkg.version}` : `pkg=${pkg.version} ≠ dxt=${dxt.version}`,
      hint: "Atualize ambos para a mesma versão (ADR-0009).",
    };
  } catch (err) {
    return {
      name: "Version sync (pkg ↔ DXT)",
      ok: false,
      detail: (err as Error).message,
    };
  }
}

/**
 * Doctor 7º check (Cycle 20): MCP primitives surface. Catches regressions tipo
 * "registry de tools quebrou import e voltou 0".
 */
async function checkMcpPrimitives(): Promise<Check> {
  const tools = allTools.length;
  const prompts = allPrompts.length;
  const resources = allResources.length;
  const ok = tools >= 30 && prompts >= 5 && resources >= 3;
  return {
    name: "MCP primitives",
    ok,
    detail: `${tools} tools / ${prompts} prompts / ${resources} resources`,
    hint: "Esperado: ≥30 tools, ≥5 prompts, ≥3 resources. Cheque imports em src/tools/index.ts, src/prompts/index.ts, src/resources/index.ts.",
  };
}

async function checkRecipes(): Promise<Check> {
  try {
    const recipes = await listRecipes();
    return {
      name: "Recipes",
      ok: true,
      detail: `${recipes.length} recipes carregadas`,
    };
  } catch (err) {
    return {
      name: "Recipes",
      ok: false,
      detail: (err as Error).message,
      hint: "Algum JSON em recipes/ está inválido.",
    };
  }
}

// biome-ignore lint/suspicious/noConsoleLog: doctor is a CLI tool — stdout IS the output channel.
const out = (msg: string): void => console.log(msg);

async function main(): Promise<void> {
  out(`\n${DIM}ableton-mind doctor${RESET}\n`);
  const checks: Check[] = [
    await checkNode(),
    await checkRemoteScript(),
    await checkBridgePort(),
    await checkKnowledge(),
    await checkRecipes(),
    await checkVersionSync(),
    await checkMcpPrimitives(),
  ];
  for (const c of checks) {
    out(fmt(c));
  }
  const failed = checks.filter((c) => !c.ok).length;
  const summary =
    failed === 0 ? `${GREEN}✓ tudo ok` : `${RED}✗ ${failed} check${failed > 1 ? "s" : ""} falharam`;
  out(`\n${summary}${RESET}\n`);
  process.exit(failed === 0 ? 0 : 1);
}

main().catch((err) => {
  console.error(`${RED}fatal:${RESET}`, err.message);
  process.exit(2);
});
