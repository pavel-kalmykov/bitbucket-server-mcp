import { test, expect } from "vitest";
import { describeBitbucket } from "./e2e-suite.js";
import { callAndParse } from "../tool-test-utils.js";

describeBitbucket("branches", ({ mcp, s }) => {
  test("list_branches returns main and feature", async () => {
    const parsed = await callAndParse<{
      total: number;
      branches: Array<{ displayId: string }>;
    }>(mcp.client, "list_branches", {
      project: s.projectKey,
      repository: s.repoSlug,
    });

    expect(parsed.total).toBeGreaterThanOrEqual(2);
    const ids = parsed.branches.map((b) => b.displayId);
    expect(ids).toContain("main");
    expect(ids).toContain("feature");
  });

  test("manage_branches create creates a new branch", async () => {
    const parsed = await callAndParse<{ displayId: string }>(
      mcp.client,
      "manage_branches",
      {
        action: "create",
        project: s.projectKey,
        repository: s.repoSlug,
        branch: "e2e-branch",
        startPoint: s.mainCommitId,
      },
    );

    expect(parsed.displayId).toBe("e2e-branch");
  });

  test("get_commit returns the main commit", async () => {
    const parsed = await callAndParse<{ id: string; message: string }>(
      mcp.client,
      "get_commit",
      {
        project: s.projectKey,
        repository: s.repoSlug,
        commitId: s.mainCommitId,
      },
    );

    expect(parsed.id).toBe(s.mainCommitId);
  });
});
