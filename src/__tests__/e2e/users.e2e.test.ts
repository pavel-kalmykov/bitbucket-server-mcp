import { expect } from "vitest";
import { callAndParse, callRaw } from "../tool-test-utils.js";
import { test, describeBitbucket } from "./e2e-suite.js";

describeBitbucket("users", () => {
  test("search_users finds the admin user", async ({ bb, mcp }) => {
    const parsed = await callAndParse<{
      total: number;
      users: Array<{ name: string }>;
    }>(mcp.client, "search_users", {
      filter: bb.admin.username,
    });

    expect(parsed.total).toBeGreaterThanOrEqual(1);
    expect(parsed.users.some((u) => u.name === bb.admin.username)).toBe(true);
  });

  test("get_user_profile returns admin details", async ({ bb, mcp }) => {
    const parsed = await callAndParse<{
      name: string;
      displayName: string;
      active: boolean;
    }>(mcp.client, "get_user_profile", {
      userSlug: bb.admin.username,
    });

    expect(parsed.name).toBe(bb.admin.username);
    expect(parsed.active).toBe(true);
  });

  test("get_user_profile returns error for unknown user", async ({ mcp }) => {
    const result = await callRaw(mcp.client, "get_user_profile", {
      userSlug: "nonexistent-user-xyz",
    });

    expect(result.isError).toBe(true);
  });
});
