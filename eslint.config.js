import js from "@eslint/js";
import tseslint from "typescript-eslint";
import globals from "globals";
import sonarjs from "eslint-plugin-sonarjs";
import importX from "eslint-plugin-import-x";

export default tseslint.config(
  js.configs.recommended,
  ...tseslint.configs.recommended,
  sonarjs.configs.recommended,
  {
    plugins: {
      "import-x": importX,
    },
    languageOptions: {
      globals: {
        ...globals.node,
        ...globals.es2022,
      },
      parserOptions: {
        ecmaVersion: 2022,
        sourceType: "module",
      },
    },
    rules: {
      "import-x/first": "error",
    },
  },
  {
    // SonarJS does not recognize test.prop() from @fast-check/vitest as test functions.
    // Upstream fix: https://github.com/SonarSource/SonarJS/pull/6849
    files: ["src/__tests__/property/**"],
    rules: {
      "sonarjs/no-empty-test-file": "off",
    },
  },
  {
    ignores: ["build/**", "node_modules/**", "src/generated/bitbucket-api.d.ts"],
  },
);
