import { defineConfig } from "vitest/config";

export default defineConfig({
  test: {
    globals: true,
    environment: "node",
    include: ["src/__tests__/**/*.test.ts"],
    exclude: ["**/node_modules/**", "src/__tests__/e2e/**"],
    coverage: {
      provider: "v8",
      reporter: ["text", "lcov", "json", "html"],
      thresholds: {
        branches: 80,
        functions: 80,
        lines: 80,
        statements: 80,
        "src/tools/**/*.ts": {
          branches: 95,
          functions: 95,
          lines: 95,
          statements: 95,
        },
        "src/http/**/*.ts": {
          branches: 90,
          functions: 90,
          lines: 90,
          statements: 90,
        },
      },
    },
  },
});
