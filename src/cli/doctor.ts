/**
 * ableton-mind doctor - installation diagnostics.
 *
 * Checks:
 *  - Node >= 20
 *  - Remote Script symlink/copy at ~/Music/Ableton/User Library/Remote Scripts/AbletonMind
 *  - Port 9876 listening (= Live loaded the script)
 *  - dist/ built (build:dxt-ready)
 *  - Valid knowledge base (loads all devices)
 *  - Valid recipes (loads all recipes)
 *
 * Phase 7. Usage: `npx ableton-mind-doctor` or `node dist/cli/doctor.js`.
 */

import { existsSync, readFileSync } from "node:fs";
import net from "node:net";
import os from "node:os";
import path from "node:path";
import { fileURLToPath } from "node:url";

import { loadAllDevices } from "../knowledge/index.js";
import { helloResultSchema } from "../live-client/handshake.js";
import { TcpJsonRpcClient } from "../live-client/index.js";
import { allPrompts } from "../prompts/index.js";
import { listRecipes } from "../recipes/index.js";
import { allResources } from "../resources/index.js";
import { allTools } from "../tools/index.js";
import { PACKAGE_VERSION } from "../version.js";
import { type DoctorCheck, describeRemoteScriptInstall, versionMatchCheck } from "./doctor-core.js";

type Check = DoctorCheck;

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
    hint: "Update Node to 20+: https://nodejs.org",
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
      name: "Remote Script installed",
      ok: false,
      detail: `Platform ${process.platform} is not supported`,
    };
  }
  const here = path.dirname(fileURLToPath(import.meta.url));
  const repoRoot = path.resolve(here, "..", "..");
  const expectedSource = path.join(repoRoot, "live", "AbletonMind");
  return describeRemoteScriptInstall(target, expectedSource);
}

async function checkBridgePort(): Promise<Check> {
  const host = process.env.ABLETON_MIND_HOST ?? "127.0.0.1";
  const port = Number(process.env.ABLETON_MIND_PORT ?? 9876);
  return await new Promise<Check>((resolve) => {
    const sock = net.createConnection({ host, port });
    const timer = setTimeout(() => {
      sock.destroy();
      resolve({
        name: `Bridge at ${host}:${port}`,
        ok: false,
        detail: "timeout",
        hint: "Open Live and enable AbletonMind in Preferences -> Link/Tempo/MIDI -> Control Surface.",
      });
    }, 1500);
    sock.once("connect", () => {
      clearTimeout(timer);
      sock.end();
      resolve({ name: `Bridge at ${host}:${port}`, ok: true, detail: "responding" });
    });
    sock.once("error", (err) => {
      clearTimeout(timer);
      resolve({
        name: `Bridge at ${host}:${port}`,
        ok: false,
        detail: err.message,
        hint: "Is Live open? Is AbletonMind selected as a Control Surface?",
      });
    });
  });
}

async function checkBridgeVersion(): Promise<Check> {
  const host = process.env.ABLETON_MIND_HOST ?? "127.0.0.1";
  const port = Number(process.env.ABLETON_MIND_PORT ?? 9876);
  const client = new TcpJsonRpcClient({
    host,
    port,
    defaultTimeoutMs: 5000,
    autoReconnect: false,
  });
  try {
    await client.connect();
    const raw = await client.call("system.hello", {
      client: "ableton-mind/doctor",
      version: PACKAGE_VERSION,
    });
    const result = helloResultSchema.parse(raw);
    return versionMatchCheck(PACKAGE_VERSION, result.version);
  } catch (err) {
    return {
      name: "Bridge version",
      ok: false,
      detail: (err as Error).message,
      hint: "Is Live open? Is the AbletonMind Control Surface selected and updated?",
    };
  } finally {
    await client.close().catch(() => undefined);
  }
}

async function checkKnowledge(): Promise<Check> {
  try {
    const devices = await loadAllDevices();
    return {
      name: "Knowledge base",
      ok: true,
      detail: `${devices.length} devices loaded`,
    };
  } catch (err) {
    return {
      name: "Knowledge base",
      ok: false,
      detail: (err as Error).message,
      hint: "Some JSON in src/knowledge/devices/ is invalid.",
    };
  }
}

/**
 * TD-039: Doctor confirms `package.json::version` == `dxt/manifest.json::version`.
 * ADR-0009 requires these versions to move together for a valid release.
 *
 * In an installed runtime (`npm i -g`), `dxt/manifest.json` may not be bundled.
 * In that case, mark `ok: true` with detail "skip (manifest not bundled)" so
 * installed users are not broken.
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
        detail: "skip (package.json not found)",
      };
    }
    const pkg = JSON.parse(readFileSync(pkgPath, "utf8")) as { version?: string };
    if (!existsSync(dxtPath)) {
      return {
        name: "Version sync (pkg ↔ DXT)",
        ok: true,
        detail: `skip (dxt/manifest.json missing, pkg=${pkg.version ?? "?"})`,
      };
    }
    const dxt = JSON.parse(readFileSync(dxtPath, "utf8")) as { version?: string };
    const ok = pkg.version === dxt.version;
    return {
      name: "Version sync (pkg ↔ DXT)",
      ok,
      detail: ok ? `v${pkg.version}` : `pkg=${pkg.version} ≠ dxt=${dxt.version}`,
      hint: "Update both to the same version (ADR-0009).",
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
 * Doctor 7th check (Cycle 20): MCP primitives surface. Catches regressions like
 * "tool registry import broke and returned to 0".
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
    hint: "Expected: >=30 tools, >=5 prompts, >=3 resources. Check imports in src/tools/index.ts, src/prompts/index.ts, src/resources/index.ts.",
  };
}

async function checkRecipes(): Promise<Check> {
  try {
    const recipes = await listRecipes();
    return {
      name: "Recipes",
      ok: true,
      detail: `${recipes.length} recipes loaded`,
    };
  } catch (err) {
    return {
      name: "Recipes",
      ok: false,
      detail: (err as Error).message,
      hint: "Some JSON in recipes/ is invalid.",
    };
  }
}

// biome-ignore lint/suspicious/noConsoleLog: doctor is a CLI tool — stdout IS the output channel.
const out = (msg: string): void => console.log(msg);

async function main(): Promise<void> {
  out(`\n${DIM}ableton-mind doctor${RESET}\n`);
  const bridgePort = await checkBridgePort();
  const checks: Check[] = [
    await checkNode(),
    await checkRemoteScript(),
    bridgePort,
    bridgePort.ok
      ? await checkBridgeVersion()
      : { name: "Bridge version", ok: true, detail: "skip (bridge offline)" },
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
    failed === 0
      ? `${GREEN}✓ all checks passed`
      : `${RED}✗ ${failed} check${failed > 1 ? "s" : ""} failed`;
  out(`\n${summary}${RESET}\n`);
  process.exit(failed === 0 ? 0 : 1);
}

main().catch((err) => {
  console.error(`${RED}fatal:${RESET}`, err.message);
  process.exit(2);
});
