import { expect } from "vitest";
import { callAndParse } from "../tool-test-utils.js";
import { test, describeBitbucket } from "./e2e-suite.js";

describeBitbucket("tags", () => {
  test("list_tags returns paginated result", async ({ mcp, scenario }) => {
    const parsed = await callAndParse<{
      total: number;
      tags: unknown[];
    }>(mcp.client, "list_tags", {
      project: scenario.projectKey,
      repository: scenario.repoSlug,
    });

    expect(Array.isArray(parsed.tags)).toBe(true);
  });

  test("manage_tags create creates a tag", async ({ mcp, scenario }) => {
    const parsed = await callAndParse<{ displayId: string }>(
      mcp.client,
      "manage_tags",
      {
        action: "create",
        project: scenario.projectKey,
        repository: scenario.repoSlug,
        name: "e2e-tag",
        startPoint: scenario.mainCommitId,
      },
    );

    expect(parsed.displayId).toBe("e2e-tag");
  });
});
