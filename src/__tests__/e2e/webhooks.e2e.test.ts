import { expect } from "vitest";
import { callAndParse } from "../tool-test-utils.js";
import { test, describeBitbucket } from "./e2e-suite.js";

describeBitbucket("webhooks", () => {
  test("list_webhooks returns data", async ({ mcp, scenario }) => {
    const r = await callAndParse<{ total: number }>(
      mcp.client,
      "list_webhooks",
      { project: scenario.projectKey, repository: scenario.repoSlug },
    );
    expect(typeof r.total).toBe("number");
  });

  test("manage_webhooks create and delete round-trip", async ({
    mcp,
    scenario,
  }) => {
    const create = await callAndParse<{ id: number }>(
      mcp.client,
      "manage_webhooks",
      {
        action: "create",
        project: scenario.projectKey,
        repository: scenario.repoSlug,
        name: "e2e-hook-" + Date.now(),
        url: "https://example.com/hook",
        events: ["repo:refs_changed"],
      },
    );
    const del = await callAndParse<{ deleted: boolean }>(
      mcp.client,
      "manage_webhooks",
      {
        action: "delete",
        project: scenario.projectKey,
        repository: scenario.repoSlug,
        webhookId: create.id,
      },
    );
    expect(del.deleted).toBe(true);
  });
});
