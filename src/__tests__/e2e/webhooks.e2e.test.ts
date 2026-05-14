import { describe, test, expect, beforeAll, afterAll } from "vitest";
import {
  startBitbucket,
  type StartedBitbucket,
} from "./bitbucket-container.js";
import { bootstrap, type Scenario } from "./bootstrap.js";
import { setupMcpAgainst, type McpAgainstBitbucket } from "./mcp-harness.js";
import { callAndParse } from "../tool-test-utils.js";
import { SELECTED_VERSIONS } from "./versions.js";

describe.each(SELECTED_VERSIONS)("webhooks: Bitbucket $name", (version) => {
  let bb: StartedBitbucket;
  let mcp: McpAgainstBitbucket;
  let s: Scenario;

  beforeAll(async () => {
    bb = await startBitbucket(version);
    s = await bootstrap(bb.api);
    mcp = await setupMcpAgainst(bb);
  }, 420_000);

  afterAll(async () => {
    await mcp?.close();
    await bb?.stop();
  });

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
