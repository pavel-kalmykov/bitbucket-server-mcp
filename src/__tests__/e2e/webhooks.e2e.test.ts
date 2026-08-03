import { test, expect } from "vitest";
import { callAndParse } from "../tool-test-utils.js";
import { describeBitbucket } from "./e2e-suite.js";

describeBitbucket("webhooks", ({ mcp, s }) => {
  test("list_webhooks returns data", async () => {
    const r = await callAndParse<{ total: number }>(
      mcp.client,
      "list_webhooks",
      { project: s.projectKey, repository: s.repoSlug },
    );
    expect(typeof r.total).toBe("number");
  });

  test("manage_webhooks create and delete round-trip", async () => {
    const create = await callAndParse<{ id: number }>(
      mcp.client,
      "manage_webhooks",
      {
        action: "create",
        project: s.projectKey,
        repository: s.repoSlug,
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
        project: s.projectKey,
        repository: s.repoSlug,
        webhookId: create.id,
      },
    );
    expect(del.deleted).toBe(true);
  });
});
