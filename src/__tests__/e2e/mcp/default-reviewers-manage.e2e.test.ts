import { expect } from "vitest";
import { callAndParse } from "../../fixtures/tool-test-utils.js";
import { test, describeBitbucket } from ".././e2e-suite.js";

describeBitbucket("default reviewers", () => {
  test("manage_default_reviewers create, list, and delete round-trip", async ({
    mcp,
    scenario,
  }) => {
    const created = await callAndParse<{ id: number }>(
      mcp.client,
      "manage_default_reviewers",
      {
        action: "create",
        project: scenario.project.key,
        repository: scenario.project.repo.slug,
        reviewers: ["admin"],
        sourceRef: "main",
        targetRef: "main",
        requiredApprovals: 1,
      },
    );
    expect(typeof created.id).toBe("number");

    const listed = await callAndParse<
      Array<{ id: number; reviewers: Array<{ name: string }> }>
    >(mcp.client, "list_default_reviewer_conditions", {
      project: scenario.project.key,
      repository: scenario.project.repo.slug,
      fields: "*all",
    });
    const condition = listed.find((c) => c.id === created.id);
    expect(condition).toBeDefined();
    expect(condition?.reviewers.map((r) => r.name)).toContain("admin");

    const removed = await callAndParse<{
      deleted: boolean;
      conditionId: number;
    }>(mcp.client, "manage_default_reviewers", {
      action: "delete",
      project: scenario.project.key,
      repository: scenario.project.repo.slug,
      conditionId: created.id,
    });
    expect(removed.deleted).toBe(true);
    expect(removed.conditionId).toBe(created.id);
  });
});
