import { expect } from "vitest";
import { callAndParse } from "../../fixtures/tool-test-utils.js";
import { test, describeBitbucket } from ".././e2e-suite.js";

describeBitbucket("default reviewers", () => {
  test("list_default_reviewer_conditions returns array", async ({
    mcp,
    scenario,
  }) => {
    const r = await callAndParse<unknown[]>(
      mcp.client,
      "list_default_reviewer_conditions",
      { project: scenario.project.key, repository: scenario.project.repo.slug },
    );
    expect(Array.isArray(r)).toBe(true);
  });
});
