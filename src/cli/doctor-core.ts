import { existsSync, lstatSync, readlinkSync, realpathSync } from "node:fs";
import path from "node:path";

export interface DoctorCheck {
  name: string;
  ok: boolean;
  detail?: string;
  hint?: string;
}

function resolveExistingOrAbsolute(p: string): string {
  try {
    return realpathSync(p);
  } catch {
    return path.resolve(p);
  }
}

function resolveSymlinkTarget(linkPath: string, rawTarget: string): string {
  return path.isAbsolute(rawTarget) ? rawTarget : path.resolve(path.dirname(linkPath), rawTarget);
}

export function describeRemoteScriptInstall(target: string, expectedSource: string): DoctorCheck {
  if (!existsSync(target) && !isDanglingSymlink(target)) {
    return {
      name: "Remote Script installed",
      ok: false,
      detail: "missing",
      hint: "Run `node scripts/install-remote-script.mjs` from the repo root.",
    };
  }

  const stat = lstatSync(target);
  if (stat.isSymbolicLink()) {
    const rawTarget = readlinkSync(target);
    const resolvedTarget = resolveSymlinkTarget(target, rawTarget);
    const actual = resolveExistingOrAbsolute(resolvedTarget);
    const expected = resolveExistingOrAbsolute(expectedSource);
    const ok = actual === expected;
    return {
      name: "Remote Script instalado",
      ok,
      detail: `symlink -> ${actual}`,
      hint: ok
        ? undefined
        : "Reinstall so it points to the current checkout: `node scripts/install-remote-script.mjs --force`.",
    };
  }

  if (stat.isDirectory()) {
    return {
      name: "Remote Script installed",
      ok: true,
      detail: "copy",
    };
  }

  return {
    name: "Remote Script installed",
    ok: false,
    detail: "unexpected file",
    hint: "Remove the file and run `node scripts/install-remote-script.mjs`.",
  };
}

export function versionMatchCheck(
  packageVersion: string | undefined,
  bridgeVersion: string | undefined,
): DoctorCheck {
  const pkg = packageVersion ?? "?";
  const bridge = bridgeVersion ?? "?";
  const ok = pkg !== "?" && bridge !== "?" && pkg === bridge;
  return {
    name: "Bridge version",
    ok,
    detail: `bridge=${bridge} pkg=${pkg}`,
    hint: ok
      ? undefined
      : "Reinstall the Remote Script from this checkout and restart/reactivate the Control Surface in Ableton Live.",
  };
}

function isDanglingSymlink(target: string): boolean {
  try {
    return lstatSync(target).isSymbolicLink();
  } catch {
    return false;
  }
}
