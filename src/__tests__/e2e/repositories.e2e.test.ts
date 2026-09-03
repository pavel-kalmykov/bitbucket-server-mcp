import { expect } from "vitest";
import { callAndParse } from "../tool-test-utils.js";
import { test, describeBitbucket } from "./e2e-suite.js";

describeBitbucket("repositories", () => {
  test("create_repository and delete_repository round-trip", async ({
    mcp,
    scenario,
  }) => {
    const repoName = "e2e-repo-" + Date.now();
    const create = await callAndParse<{ slug: string }>(
      mcp.client,
      "create_repository",
      { project: scenario.projectKey, name: repoName },
    );
    expect(create.slug).toBe(repoName);

    const del = await callAndParse<{ deleted: boolean }>(
      mcp.client,
      "delete_repository",
      { project: scenario.projectKey, repository: repoName },
    );
    expect(del.deleted).toBe(true);
  });
});
