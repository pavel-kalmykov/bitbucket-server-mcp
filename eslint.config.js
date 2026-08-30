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
    // Every operation on an api namespace must be `async`, so that a failure
    // raised before the request is made (a missing project, say) arrives as a
    // rejected promise like any other. Without it the same namespace would
    // throw synchronously from some methods and reject from others, and a
    // caller's `.catch()` would only see half of them.
    //
    // Scoped to the object-literal methods: the module-level helpers
    // (`getPaginated`, `defaultBranchOf`) are function declarations and stay
    // as they are.
    files: ["src/api/**/*.ts"],
    languageOptions: {
      parserOptions: {
        projectService: true,
        tsconfigRootDir: import.meta.dirname,
      },
    },
    rules: {
      "@typescript-eslint/promise-function-async": [
        "error",
        {
          checkFunctionDeclarations: false,
          checkArrowFunctions: false,
        },
      ],
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
    ignores: [
      "build/**",
      "node_modules/**",
      "src/generated/bitbucket-api.d.ts",
    ],
  },
);
