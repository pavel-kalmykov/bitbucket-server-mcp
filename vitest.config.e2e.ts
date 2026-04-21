import { defineConfig } from "vitest/config";

/**
 * The e2e suite boots real Bitbucket containers and is orders of
 * magnitude slower than the unit suite. It runs with a single worker to
 * keep RAM under control locally; CI parallelises across jobs via the
 * workflow matrix instead.
 */
export default defineConfig({
  test: {
    globals: true,
    environment: "node",
    include: ["src/__tests__/e2e/**/*.e2e.test.ts"],
    testTimeout: 180_000,
    hookTimeout: 420_000,
    fileParallelism: false,
    forks: { singleFork: true },
  },
});
