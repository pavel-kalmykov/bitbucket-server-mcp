import { defineConfig } from "vitest/config";
import { VERSIONS } from "./src/__tests__/e2e/versions.js";

/**
 * The version matrix is one vitest project per Bitbucket version. Fixture
 * scope is the file, so a project is also the only thing that can vary the
 * version under test: each pins E2E_VERSIONS for its own tests.
 *
 * A plain `npm run test:e2e` runs every project, one after another, with one
 * container alive at a time. `--project e2e-<version>` narrows to one, which
 * is what each CI job does. If projects ever stop running sequentially, RAM
 * is the thing to re-check.
 *
 * `testTimeout` covers a container boot, not just an assertion. The suite
 * hands the container to tests as a file-scoped fixture, and vitest charges a
 * file fixture's setup to whichever test triggers it, with no per-fixture
 * timeout to separate the two. A boot takes ~95s on a CI runner and up to
 * ~240s for the amd64-only 7.21 image under emulation, so the budget has to
 * clear that. The cost of the generous number is that a genuinely stuck
 * assertion takes this long to fail; tighten a specific test with the
 * per-test `timeout` option if that ever matters.
 */
const perProject = {
  globals: true,
  environment: "node",
  include: ["src/__tests__/e2e/**/*.e2e.test.ts"],
  setupFiles: ["./src/__tests__/e2e/setup-env.ts"],
  testTimeout: 420_000,
  hookTimeout: 420_000,
  fileParallelism: false,
  forks: { singleFork: true },
};

export default defineConfig({
  test: {
    projects: VERSIONS.map((version) => ({
      test: {
        ...perProject,
        name: `e2e-${version.name}`,
        env: { E2E_VERSIONS: version.name },
      },
    })),
  },
});
