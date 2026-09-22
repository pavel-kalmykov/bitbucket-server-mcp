import { existsSync } from "node:fs";
import type { TestProject } from "vitest/node";
import { startBitbucket } from "./bitbucket-container.js";
import { VERSIONS } from "./versions.js";

// Local DX, same contract as setup-env.ts: pick up
// BITBUCKET_TIMEBOMB_LICENSE from `.env`. globalSetup runs outside the
// test workers, so setupFiles do not apply here. No-op in CI, where the
// workflow injects the env directly.
if (existsSync(".env")) {
  process.loadEnvFile(".env");
}

declare module "vitest" {
  interface ProvidedContext {
    bbUrl: string;
    bbVersion: string;
  }
}

/**
 * Boots one Bitbucket container per project (= per version) and provides
 * its URL to every test file through `inject`. Runs once per project run:
 * vitest memoizes the setup, and the returned teardown stops the
 * container when the run ends.
 *
 * The fixture side attaches through `attachStartedBitbucket` instead of
 * starting anything, because vitest re-runs worker-scoped fixtures per
 * test file and a boot in there would cost ~45s per file.
 */
export default async function globalSetup(
  project: TestProject,
): Promise<() => Promise<void>> {
  const versionName = project.name.replace(/^e2e-/, "");
  const version = VERSIONS.find((v) => v.name === versionName);
  if (!version) {
    throw new Error(
      `Unknown E2E version "${versionName}" for project "${project.name}".`,
    );
  }

  const bb = await startBitbucket(version);
  project.provide("bbUrl", bb.url);
  project.provide("bbVersion", bb.version);

  return async () => {
    await bb.stop();
  };
}
