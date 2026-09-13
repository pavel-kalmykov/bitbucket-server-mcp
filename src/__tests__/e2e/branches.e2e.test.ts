import { expect } from "vitest";
import { test, describeBitbucket } from "./e2e-suite.js";
import { callAndParse } from "../tool-test-utils.js";

describeBitbucket("branches", () => {
  test("list_branches returns main and feature", async ({ mcp, scenario }) => {
    // Awaiting pr lazily creates the feature branch this test asserts on.
    await scenario.project.repo.pr;
    const parsed = await callAndParse<{
      total: number;
      branches: Array<{ displayId: string }>;
    }>(mcp.client, "list_branches", {
      project: scenario.project.key,
      repository: scenario.project.repo.slug,
    });

    expect(parsed.total).toBeGreaterThanOrEqual(2);
    const ids = parsed.branches.map((b) => b.displayId);
    expect(ids).toContain("main");
    expect(ids).toContain("feature");
  });

  test("manage_branches create creates a new branch", async ({
    mcp,
    scenario,
  }) => {
    const parsed = await callAndParse<{ displayId: string }>(
      mcp.client,
      "manage_branches",
      {
        action: "create",
        project: scenario.project.key,
        repository: scenario.project.repo.slug,
        branch: "e2e-branch",
        startPoint: await scenario.project.repo.branches.main.firstCommit.id,
      },
    );

    expect(parsed.displayId).toBe("e2e-branch");
  });

  test("get_commit returns the main commit", async ({ mcp, scenario }) => {
    const parsed = await callAndParse<{ id: string; message: string }>(
      mcp.client,
      "get_commit",
      {
        project: scenario.project.key,
        repository: scenario.project.repo.slug,
        commitId: await scenario.project.repo.branches.main.firstCommit.id,
      },
    );

    expect(parsed.id).toBe(
      await scenario.project.repo.branches.main.firstCommit.id,
    );
  });
});
