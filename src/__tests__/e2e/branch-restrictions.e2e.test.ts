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
  "branch restrictions: Bitbucket $name",
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

    test("list_branch_restrictions returns data", async () => {
      const r = await callAndParse<{ total: number; restrictions: unknown[] }>(
        mcp.client,
        "list_branch_restrictions",
        { project: s.projectKey, repository: s.repoSlug },
      );
      expect(typeof r.total).toBe("number");
      expect(Array.isArray(r.restrictions)).toBe(true);
    });
  },
);
