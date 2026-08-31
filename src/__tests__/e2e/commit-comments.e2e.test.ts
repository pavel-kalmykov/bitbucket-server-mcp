import { expect } from "vitest";
import { callAndParse } from "../tool-test-utils.js";
import { test, describeBitbucket } from "./e2e-suite.js";

describeBitbucket("commit comments", () => {
  test("manage_commit_comments create adds a comment", async ({
    mcp,
    scenario,
  }) => {
    const parsed = await callAndParse<{ id: number; text: string }>(
      mcp.client,
      "manage_commit_comments",
      {
        action: "create",
        project: scenario.projectKey,
        repository: scenario.repoSlug,
        commitId: scenario.mainCommitId,
        text: "E2E commit comment",
      },
    );

    expect(parsed.id).toBeDefined();
    expect(parsed.text).toBe("E2E commit comment");
  });
});
