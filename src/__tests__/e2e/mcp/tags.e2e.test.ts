import { expect } from "vitest";
import { callAndParse } from "../../fixtures/tool-test-utils.js";
import { test, describeBitbucket } from ".././e2e-suite.js";

describeBitbucket("tags", () => {
  test("list_tags returns paginated result", async ({ mcp, scenario }) => {
    const parsed = await callAndParse<{
      total: number;
      tags: unknown[];
    }>(mcp.client, "list_tags", {
      project: scenario.project.key,
      repository: scenario.project.repo.slug,
    });

    expect(Array.isArray(parsed.tags)).toBe(true);
  });

  test("manage_tags create creates a tag", async ({ mcp, scenario }) => {
    const parsed = await callAndParse<{ displayId: string }>(
      mcp.client,
      "manage_tags",
      {
        action: "create",
        project: scenario.project.key,
        repository: scenario.project.repo.slug,
        name: "e2e-tag",
        startPoint: await scenario.project.repo.branches.main.firstCommit.id,
      },
    );

    expect(parsed.displayId).toBe("e2e-tag");
  });
});
