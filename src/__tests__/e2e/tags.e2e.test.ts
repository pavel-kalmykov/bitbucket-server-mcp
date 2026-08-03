import { describe, test, expect, beforeAll, afterAll } from "vitest";
import { SELECTED_VERSIONS } from "./versions.js";
import {
  startBitbucket,
  type StartedBitbucket,
} from "./bitbucket-container.js";
import { bootstrap, type Scenario } from "./bootstrap.js";
import { setupMcpAgainst, type McpAgainstBitbucket } from "./mcp-harness.js";
import { callAndParse } from "../tool-test-utils.js";

describe.each(SELECTED_VERSIONS)("tags: Bitbucket $name", (version) => {
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

  test("list_tags returns paginated result", async () => {
    const parsed = await callAndParse<{
      total: number;
      tags: unknown[];
    }>(mcp.client, "list_tags", {
      project: s.projectKey,
      repository: s.repoSlug,
    });

    expect(Array.isArray(parsed.tags)).toBe(true);
  });

  test("manage_tags create creates a tag", async () => {
    const parsed = await callAndParse<{ displayId: string }>(
      mcp.client,
      "manage_tags",
      {
        action: "create",
        project: s.projectKey,
        repository: s.repoSlug,
        name: "e2e-tag",
        startPoint: s.mainCommitId,
      },
    );

    expect(parsed.displayId).toBe("e2e-tag");
  });
});
