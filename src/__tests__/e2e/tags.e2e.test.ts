import { test, expect } from "vitest";
import { callAndParse } from "../tool-test-utils.js";
import { describeBitbucket } from "./e2e-suite.js";

describeBitbucket("tags", ({ mcp, s }) => {
  test("list_tags returns paginated result", async () => {
    const parsed = await callAndParse<{
      total: number;
      tags: unknown[];
    }>(mcp.client, "list_tags", {
      project: s.projectKey,
      repository: s.repoSlug,
    });

    expect(Array.isArray(parsed.tags)).toBe(true);
  });

  test("manage_tags create creates a tag", async () => {
    const parsed = await callAndParse<{ displayId: string }>(
      mcp.client,
      "manage_tags",
      {
        action: "create",
        project: s.projectKey,
        repository: s.repoSlug,
        name: "e2e-tag",
        startPoint: s.mainCommitId,
      },
    );

    expect(parsed.displayId).toBe("e2e-tag");
  });
});
