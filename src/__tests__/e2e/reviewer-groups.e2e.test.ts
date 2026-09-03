import { expect } from "vitest";
import { callAndParse } from "../tool-test-utils.js";
import { test, describeBitbucket } from "./e2e-suite.js";

describeBitbucket("reviewer groups", () => {
  test("list_reviewer_groups returns empty list initially", async ({
    mcp,
    scenario,
  }) => {
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
