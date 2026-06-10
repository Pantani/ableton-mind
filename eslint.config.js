// @ts-check
/**
 * ESLint config used only for the Cyclomatic Complexity metric.
 *
 * Intentional scope: ONLY the `complexity` rule (ESLint core), limit 10.
 * General linting stays with Biome (`biome.json`). This config exists to
 * produce an actionable TS/JS complexity metric.
 */
import tseslint from "typescript-eslint";

export default tseslint.config(
  {
    ignores: [
      "node_modules/**",
      "dist/**",
      "coverage/**",
      "live/**",
      "_workspace/**",
      "docs/**",
      ".ruff_cache/**",
      "src/knowledge/**/*.json",
    ],
  },
  {
    files: ["**/*.{ts,tsx,cts,mts}"],
    languageOptions: {
      parser: tseslint.parser,
      parserOptions: {
        ecmaVersion: "latest",
        sourceType: "module",
      },
    },
    rules: {
      complexity: ["error", 10],
    },
  },
  {
    files: ["**/*.{js,mjs,cjs}"],
    languageOptions: {
      ecmaVersion: "latest",
      sourceType: "module",
    },
    rules: {
      complexity: ["error", 10],
    },
  },
);
