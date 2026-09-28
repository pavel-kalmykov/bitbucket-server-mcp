import { expect } from "vitest";
import { callAndParse } from "../../fixtures/tool-test-utils.js";
import { test, describeBitbucket } from ".././e2e-suite.js";

describeBitbucket("branch restrictions", () => {
  test("list_branch_restrictions returns data", async ({ mcp, scenario }) => {
    const r = await callAndParse<{ total: number; restrictions: unknown[] }>(
      mcp.client,
      "list_branch_restrictions",
      { project: scenario.project.key, repository: scenario.project.repo.slug },
    );
    expect(typeof r.total).toBe("number");
    expect(Array.isArray(r.restrictions)).toBe(true);
  });

  test("list_branch_restrictions curates the response", async ({
    mcp,
    scenario,
  }) => {
    const r = await callAndParse<{
      restrictions: Array<Record<string, unknown>>;
    }>(mcp.client, "list_branch_restrictions", {
      project: scenario.project.key,
      repository: scenario.project.repo.slug,
      fields: "id,type",
    });
    for (const restriction of r.restrictions) {
      expect(Object.keys(restriction).sort()).toEqual(["id", "type"]);
    }
  });
});
