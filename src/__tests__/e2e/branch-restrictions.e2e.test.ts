import { test, expect } from "vitest";
import { callAndParse } from "../tool-test-utils.js";
import { describeBitbucket } from "./e2e-suite.js";

describeBitbucket("branch restrictions", ({ mcp, s }) => {
  test("list_branch_restrictions returns data", async () => {
    const r = await callAndParse<{ total: number; restrictions: unknown[] }>(
      mcp.client,
      "list_branch_restrictions",
      { project: s.projectKey, repository: s.repoSlug },
    );
    expect(typeof r.total).toBe("number");
    expect(Array.isArray(r.restrictions)).toBe(true);
  });
});
