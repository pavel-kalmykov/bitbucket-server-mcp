import { expect } from "vitest";
import { callAndParse } from "../../fixtures/tool-test-utils.js";
import { test, describeBitbucket } from ".././e2e-suite.js";

describeBitbucket("projects", () => {
  test("manage_projects create, update, and delete round-trip", async ({
    mcp,
  }) => {
    const key = `MCP${Date.now().toString(36).toUpperCase()}`;
    const created = await callAndParse<Record<string, unknown>>(
      mcp.client,
      "manage_projects",
      {
        action: "create",
        name: `MCP round-trip ${key}`,
        key,
        description: "created by the manage_projects e2e",
      },
    );
    expect(created.key).toBe(key);

    const updated = await callAndParse<Record<string, unknown>>(
      mcp.client,
      "manage_projects",
      { action: "update", project: key, description: "updated by e2e" },
    );
    expect(updated.description).toBe("updated by e2e");

    const removed = await callAndParse<{ deleted: boolean; project: string }>(
      mcp.client,
      "manage_projects",
      { action: "delete", project: key },
    );
    expect(removed.deleted).toBe(true);
    expect(removed.project).toBe(key);
  });
});
