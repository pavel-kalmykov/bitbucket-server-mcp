import { expect } from "vitest";
import { callAndParse } from "../tool-test-utils.js";
import { test, describeBitbucket } from "./e2e-suite.js";

describeBitbucket("reviewer groups", () => {
  test("create, list, and delete a reviewer group", async ({
    mcp,
    scenario,
  }) => {
    const args = {
      project: scenario.project.key,
      repository: scenario.project.repo.slug,
    };

    const initial = await callAndParse<unknown[]>(
      mcp.client,
      "list_reviewer_groups",
      args,
    );
    expect(initial).toEqual([]);

    const created = await callAndParse<Record<string, unknown>>(
      mcp.client,
      "create_reviewer_group",
      {
        ...args,
        name: "backend-reviewers",
        description: "Backend reviewers",
        reviewers: ["admin"],
      },
    );
    expect(created.name).toBe("backend-reviewers");
    expect(created.description).toBe("Backend reviewers");
    expect(Number(created.id)).toBeGreaterThan(0);

    const listed = await callAndParse<Array<Record<string, unknown>>>(
      mcp.client,
      "list_reviewer_groups",
      args,
    );
    expect(listed).toHaveLength(1);
    expect(listed[0].name).toBe("backend-reviewers");
    const deleted = await callAndParse<Record<string, unknown>>(
      mcp.client,
      "delete_reviewer_group",
      { ...args, name: "backend-reviewers" },
    );
    expect(deleted).toEqual({ deleted: true, name: "backend-reviewers" });

    const emptied = await callAndParse<unknown[]>(
      mcp.client,
      "list_reviewer_groups",
      args,
    );
    expect(emptied).toEqual([]);
  });
});
