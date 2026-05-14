import { describe, test, expect, beforeAll, afterAll } from "vitest";
import {
  startBitbucket,
  type StartedBitbucket,
} from "./bitbucket-container.js";
import { bootstrap, type Scenario } from "./bootstrap.js";
import { setupMcpAgainst, type McpAgainstBitbucket } from "./mcp-harness.js";
import { callAndParse } from "../tool-test-utils.js";
import { SELECTED_VERSIONS } from "./versions.js";

describe.each(SELECTED_VERSIONS)(
  "pull requests: Bitbucket $name",
  (version) => {
    let bb: StartedBitbucket;
    let mcp: McpAgainstBitbucket;
    let s: Scenario;

    beforeAll(async () => {
      bb = await startBitbucket(version);
      s = await bootstrap(bb.api);
      mcp = await setupMcpAgainst(bb);
    }, 420_000);

    afterAll(async () => {
      await mcp?.close();
      await bb?.stop();
    });

    test("get_pull_request_commits returns data", async () => {
      const r = await callAndParse<{ total: number }>(
        mcp.client,
        "get_pull_request_commits",
        {
          project: s.projectKey,
          repository: s.repoSlug,
          prId: s.prId,
          limit: 1,
        },
      );
      expect(typeof r.total).toBe("number");
    });
  },
);
