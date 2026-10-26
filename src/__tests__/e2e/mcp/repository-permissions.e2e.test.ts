import { expect } from "vitest";
import { callAndParse } from "../../fixtures/tool-test-utils.js";
import { test, describeBitbucket } from ".././e2e-suite.js";

describeBitbucket("repository permissions", () => {
  test("grant, list, and revoke round-trip", async ({ mcp, scenario }) => {
    const args = {
      project: scenario.project.key,
      repository: scenario.project.repo.slug,
    };
    const group = "stash-users";

    const granted = await callAndParse<Record<string, unknown>>(
      mcp.client,
      "manage_repository_permissions",
      {
        ...args,
        action: "grant",
        subject: "group",
        permission: "REPO_READ",
        names: [group],
      },
    );
    expect(granted.granted).toBe(true);

    const listed = await callAndParse<{
      permissions: Array<{ name: string; permission: string }>;
    }>(mcp.client, "manage_repository_permissions", {
      ...args,
      action: "list-groups",
    });
    const entry = listed.permissions.find((p) => p.name === group);
    expect(entry?.permission).toBe("REPO_READ");

    const revoked = await callAndParse<Record<string, unknown>>(
      mcp.client,
      "manage_repository_permissions",
      {
        ...args,
        action: "revoke",
        subject: "group",
        name: group,
      },
    );
    expect(revoked.revoked).toBe(true);

    const after = await callAndParse<{
      permissions: Array<{ name: string }>;
    }>(mcp.client, "manage_repository_permissions", {
      ...args,
      action: "list-groups",
    });
    expect(after.permissions.some((p) => p.name === group)).toBe(false);
  });
});
