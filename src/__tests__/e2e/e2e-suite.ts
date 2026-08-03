import { describe, beforeAll, afterAll } from "vitest";
import { SELECTED_VERSIONS } from "./versions.js";
import {
  startBitbucket,
  type StartedBitbucket,
} from "./bitbucket-container.js";
import { bootstrap, type Scenario } from "./bootstrap.js";
import { setupMcpAgainst, type McpAgainstBitbucket } from "./mcp-harness.js";

export interface BitbucketSuite {
  bb: StartedBitbucket;
  mcp: McpAgainstBitbucket;
  s: Scenario;
}

export function describeBitbucket(
  name: string,
  fn: (suite: BitbucketSuite) => void,
  versions = SELECTED_VERSIONS,
): void {
  describe.each(versions)(`${name}: Bitbucket $name`, (version) => {
    let bb!: StartedBitbucket;
    let mcp!: McpAgainstBitbucket;
    let s!: Scenario;

    beforeAll(async () => {
      bb = await startBitbucket(version);
      s = await bootstrap(bb.api);
      mcp = await setupMcpAgainst(bb);
    }, 420_000);

    afterAll(async () => {
      await mcp?.close();
      await bb?.stop();
    });

    fn({ bb, mcp, s });
  });
}
