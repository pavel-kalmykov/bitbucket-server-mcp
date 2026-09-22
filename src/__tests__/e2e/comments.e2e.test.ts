import { expect } from "vitest";
import { callAndParse } from "../tool-test-utils.js";
import { test, describeBitbucket } from "./e2e-suite.js";

describeBitbucket("comments", () => {
  test("manage_comment create adds a comment", async ({ mcp, scenario }) => {
    const parsed = await callAndParse<{
      id: number;
      text: string;
    }>(mcp.client, "manage_comment", {
      action: "create",
      project: scenario.project.key,
      repository: scenario.project.repo.slug,
      prId: (await scenario.project.repo.pr).id,
      text: "E2E smoke test comment",
    });

    expect(parsed.id).toBeDefined();
    expect(parsed.text).toBe("E2E smoke test comment");
  });

  test("search_emoticons returns results", async ({ mcp }) => {
    const parsed = await callAndParse<Array<{ shortcut: string }>>(
      mcp.client,
      "search_emoticons",
      { query: "thumb" },
    );

    expect(parsed.length).toBeGreaterThan(0);
  });
});
