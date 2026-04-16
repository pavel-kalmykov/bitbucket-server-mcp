import js from "@eslint/js";
import tseslint from "typescript-eslint";
import globals from "globals";
import sonarjs from "eslint-plugin-sonarjs";

export default tseslint.config(
  js.configs.recommended,
  ...tseslint.configs.recommended,
  sonarjs.configs.recommended,
  {
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
  },
  {
    ignores: ["build/**", "node_modules/**", "src/generated/bitbucket-api.d.ts"],
  },
);
