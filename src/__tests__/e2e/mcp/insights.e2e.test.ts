import { expect } from "vitest";
import { callRaw } from "../../fixtures/tool-test-utils.js";
import { test, describeBitbucket } from ".././e2e-suite.js";

describeBitbucket("insights", () => {
  test("get_build_status returns result for a commit", async ({
    mcp,
    scenario,
  }) => {
    const result = await callRaw(mcp.client, "get_build_status", {
      commitId: await scenario.project.repo.branches.main.firstCommit.id,
    });

    expect(result.isError).toBeFalsy();
  });
});
