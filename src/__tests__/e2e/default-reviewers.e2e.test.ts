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
  "default reviewers: Bitbucket $name",
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

    test("list_default_reviewer_conditions returns array", async () => {
      const r = await callAndParse<unknown[]>(
        mcp.client,
        "list_default_reviewer_conditions",
        { project: s.projectKey, repository: s.repoSlug },
      );
      expect(Array.isArray(r)).toBe(true);
    });
  },
);
