import { describe, test, expect, beforeAll, afterAll } from "vitest";
import { SELECTED_VERSIONS } from "./versions.js";
import {
  startBitbucket,
  type StartedBitbucket,
} from "./bitbucket-container.js";
import { setupMcpAgainst, type McpAgainstBitbucket } from "./mcp-harness.js";
import { callAndParse, callRaw } from "../tool-test-utils.js";

describe.each(SELECTED_VERSIONS)("users: Bitbucket $name", (version) => {
  let bb: StartedBitbucket;
  let mcp: McpAgainstBitbucket;

  beforeAll(async () => {
    bb = await startBitbucket(version);
    mcp = await setupMcpAgainst(bb);
  }, 420_000);

  afterAll(async () => {
    await mcp?.close();
    await bb?.stop();
  });

  test("search_users finds the admin user", async () => {
    const parsed = await callAndParse<{
      total: number;
      users: Array<{ name: string }>;
    }>(mcp.client, "search_users", {
      filter: bb.admin.username,
    });

    expect(parsed.total).toBeGreaterThanOrEqual(1);
    expect(parsed.users.some((u) => u.name === bb.admin.username)).toBe(true);
  });

  test("get_user_profile returns admin details", async () => {
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

  test("get_user_profile returns error for unknown user", async () => {
    const result = await callRaw(mcp.client, "get_user_profile", {
      userSlug: "nonexistent-user-xyz",
    });

    expect(result.isError).toBe(true);
  });
});
