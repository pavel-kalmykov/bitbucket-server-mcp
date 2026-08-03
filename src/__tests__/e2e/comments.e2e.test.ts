import { test, expect } from "vitest";
import { callAndParse } from "../tool-test-utils.js";
import { describeBitbucket } from "./e2e-suite.js";

describeBitbucket("comments", ({ mcp, s }) => {
  test("manage_comment create adds a comment", async () => {
    const parsed = await callAndParse<{
      id: number;
      text: string;
    }>(mcp.client, "manage_comment", {
      action: "create",
      project: s.projectKey,
      repository: s.repoSlug,
      prId: s.prId,
      text: "E2E smoke test comment",
    });

    expect(parsed.id).toBeDefined();
    expect(parsed.text).toBe("E2E smoke test comment");
  });

  test("search_emoticons returns results", async () => {
    const parsed = await callAndParse<Array<{ shortcut: string }>>(
      mcp.client,
      "search_emoticons",
      { query: "thumb" },
    );

    expect(parsed.length).toBeGreaterThan(0);
  });
});
