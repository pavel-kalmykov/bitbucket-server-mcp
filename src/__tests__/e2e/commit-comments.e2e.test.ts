import { test, expect } from "vitest";
import { callAndParse } from "../tool-test-utils.js";
import { describeBitbucket } from "./e2e-suite.js";

describeBitbucket("commit comments", ({ mcp, s }) => {
  test("manage_commit_comments create adds a comment", async () => {
    const parsed = await callAndParse<{ id: number; text: string }>(
      mcp.client,
      "manage_commit_comments",
      {
        action: "create",
        project: s.projectKey,
        repository: s.repoSlug,
        commitId: s.mainCommitId,
        text: "E2E commit comment",
      },
    );

    expect(parsed.id).toBeDefined();
    expect(parsed.text).toBe("E2E commit comment");
  });
});
