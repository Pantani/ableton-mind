import { createRequire } from "node:module";

interface PackageJson {
  version?: string;
}

const require = createRequire(import.meta.url);

function readPackageJson(): PackageJson {
  for (const rel of ["../package.json", "../../package.json"]) {
    try {
      return require(rel) as PackageJson;
    } catch (err) {
      const code = (err as NodeJS.ErrnoException).code;
      if (code !== "MODULE_NOT_FOUND") throw err;
    }
  }
  return {};
}

export const PACKAGE_VERSION = readPackageJson().version ?? "0.0.0+unknown";
