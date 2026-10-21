import { expect } from "vitest";
import { callAndParse } from "../../fixtures/tool-test-utils.js";
import { test, describeBitbucket } from ".././e2e-suite.js";

describeBitbucket("default branch", () => {
  test("get and set round-trip restores the original", async ({
    mcp,
    scenario,
  }) => {
    const args = {
      project: scenario.project.key,
      repository: scenario.project.repo.slug,
    };
    const original = await callAndParse<{ displayId: string }>(
      mcp.client,
      "get_default_branch",
      args,
    );

    // Setting the default to the feature branch requires the ref to exist;
    // awaiting it provisions branch + commit.
    const featureBranch = await scenario.project.repo.branches.feature;

    const set = await callAndParse<{ displayId: string }>(
      mcp.client,
      "set_default_branch",
      { ...args, branch: featureBranch.name },
    );
    expect(set.displayId).toBe(featureBranch.name);

    const after = await callAndParse<{ displayId: string }>(
      mcp.client,
      "get_default_branch",
      args,
    );
    expect(after.displayId).toBe(featureBranch.name);

    const restore = await callAndParse<{ displayId: string }>(
      mcp.client,
      "set_default_branch",
      { ...args, branch: original.displayId },
    );
    expect(restore.displayId).toBe(original.displayId);
  });
});
