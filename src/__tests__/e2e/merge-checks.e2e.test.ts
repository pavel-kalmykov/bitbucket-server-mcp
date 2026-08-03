import { test, expect } from "vitest";
import { callRaw } from "../tool-test-utils.js";
import { describeBitbucket } from "./e2e-suite.js";

describeBitbucket("merge-checks", ({ mcp, s: scenario }) => {
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
