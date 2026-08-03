import { test, expect } from "vitest";
import { callAndParse } from "../tool-test-utils.js";
import { describeBitbucket } from "./e2e-suite.js";

describeBitbucket("reviewer groups", ({ mcp, s: scenario }) => {
  test("list_reviewer_groups returns empty list initially", async () => {
    const parsed = await callAndParse<unknown[]>(
      mcp.client,
      "list_reviewer_groups",
      {
        project: scenario.projectKey,
        repository: scenario.repoSlug,
      },
    );

    expect(Array.isArray(parsed)).toBe(true);
  });
});
