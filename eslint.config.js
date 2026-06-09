// @ts-check
/**
 * ESLint config — exclusivo para a métrica de Cyclomatic Complexity.
 *
 * Escopo intencional: APENAS a regra `complexity` (core do ESLint), limite 10.
 * Linting geral fica com Biome (`biome.json`). Esta config existe para gerar
 * a métrica acionável de complexidade ciclomática em TS/JS.
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
