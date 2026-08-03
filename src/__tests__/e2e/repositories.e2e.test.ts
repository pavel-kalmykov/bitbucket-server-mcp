import { test, expect } from "vitest";
import { callAndParse } from "../tool-test-utils.js";
import { describeBitbucket } from "./e2e-suite.js";

describeBitbucket("repositories", ({ mcp, s }) => {
  test("create_repository and delete_repository round-trip", async () => {
    const repoName = "e2e-repo-" + Date.now();
    const create = await callAndParse<{ slug: string }>(
      mcp.client,
      "create_repository",
      { project: s.projectKey, name: repoName },
    );
    expect(create.slug).toBe(repoName);

    const del = await callAndParse<{ deleted: boolean }>(
      mcp.client,
      "delete_repository",
      { project: s.projectKey, repository: repoName },
    );
    expect(del.deleted).toBe(true);
  });
});
