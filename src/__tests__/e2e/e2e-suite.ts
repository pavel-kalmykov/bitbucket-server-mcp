import { describe, test as base } from "vitest";
import { activeVersion } from "./versions.js";
import {
  startBitbucket,
  type StartedBitbucket,
} from "./bitbucket-container.js";
import { bootstrap, type Scenario } from "./bootstrap.js";
import { setupMcpAgainst, type McpAgainstBitbucket } from "./mcp-harness.js";

export interface BitbucketSuite {
  bb: StartedBitbucket;
  mcp: McpAgainstBitbucket;
  scenario: Scenario;
}

/**
 * The suite's resources as vitest fixtures, scoped to the file: a test that
 * asks for one gets the instance the file already built, and teardown runs
 * once the last test is done. A test that asks for none pays for none.
 *
 * `scenario` and `mcp` depend on `bb`, which file scope allows because all
 * three share it.
 *
 * Setting these up counts against `testTimeout`, not `hookTimeout`: vitest
 * charges a file fixture to whichever test triggers it, and there is no
 * per-fixture timeout. `vitest.config.e2e.ts` sizes `testTimeout` for a
 * container boot because of this.
 */
export const test = base.extend<BitbucketSuite>({
  bb: [
    // The empty pattern is required, not stylistic: vitest reads the
    // destructuring to learn which fixtures this one depends on, and rejects
    // a plain parameter with FixtureParseError. This fixture depends on none.
    // eslint-disable-next-line no-empty-pattern
    async ({}, use) => {
      const bb = await startBitbucket(activeVersion());
      await use(bb);
      await bb.stop();
    },
    { scope: "file" },
  ],
  scenario: [
    async ({ bb }, use) => {
      await use(await bootstrap(bb.api));
    },
    { scope: "file" },
  ],
  mcp: [
    async ({ bb }, use) => {
      const mcp = await setupMcpAgainst(bb);
      await use(mcp);
      await mcp.close();
    },
    { scope: "file" },
  ],
});

/**
 * Names the suite after the version under test, so a CI log line says which
 * Bitbucket produced it. `enabled` is how a suite opts out on versions that
 * lack the feature it covers, in place of the version-partitioned lists the
 * matrix used to need.
 */
export function describeBitbucket(
  name: string,
  fn: () => void,
  enabled = true,
): void {
  describe.skipIf(!enabled)(`${name}: Bitbucket ${activeVersion().name}`, fn);
}
