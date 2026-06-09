import { defineConfig } from "tsup";

export default defineConfig({
  entry: ["src/index.ts", "src/cli/doctor.ts"],
  format: ["esm"],
  target: "node20",
  outDir: "dist",
  clean: true,
  dts: true,
  sourcemap: true,
  splitting: false,
  shims: false,
  treeshake: true,
  minify: false,
  banner: {
    js: "#!/usr/bin/env node",
  },
});
