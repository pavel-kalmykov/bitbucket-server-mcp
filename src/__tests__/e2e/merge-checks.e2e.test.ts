import { describe, test, expect, beforeAll, afterAll } from "vitest";
import { SELECTED_VERSIONS } from "./versions.js";
import {
  startBitbucket,
  type StartedBitbucket,
} from "./bitbucket-container.js";
import { bootstrap, type Scenario } from "./bootstrap.js";
import { setupMcpAgainst, type McpAgainstBitbucket } from "./mcp-harness.js";
import { callRaw } from "../tool-test-utils.js";

describe.each(SELECTED_VERSIONS)("merge-checks: Bitbucket $name", (version) => {
  let bb: StartedBitbucket;
  let mcp: McpAgainstBitbucket;
  let scenario: Scenario;

  beforeAll(async () => {
    bb = await startBitbucket(version);
    scenario = await bootstrap(bb.api);
    mcp = await setupMcpAgainst(bb);
  }, 420_000);

  afterAll(async () => {
    await mcp?.close();
    await bb?.stop();
  });

  test("manage_merge_checks returns an error for missing plugin", async () => {
    const result = await callRaw(mcp.client, "manage_merge_checks", {
      project: scenario.projectKey,
      repository: scenario.repoSlug,
      hookKey:
        "com.atlassian.bitbucket.server.bitbucket-build:requiredBuildsMergeCheck",
      settings: { requiredBuilds: 1 },
    });

    expect(result.isError).toBe(true);
  });
});
