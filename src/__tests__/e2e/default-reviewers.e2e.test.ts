import { test, expect } from "vitest";
import { callAndParse } from "../tool-test-utils.js";
import { describeBitbucket } from "./e2e-suite.js";

describeBitbucket("default reviewers", ({ mcp, s }) => {
  test("list_default_reviewer_conditions returns array", async () => {
    const r = await callAndParse<unknown[]>(
      mcp.client,
      "list_default_reviewer_conditions",
      { project: s.projectKey, repository: s.repoSlug },
    );
    expect(Array.isArray(r)).toBe(true);
  });
});
