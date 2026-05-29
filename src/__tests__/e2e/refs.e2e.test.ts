import { describe, test, expect, beforeAll, afterAll } from "vitest";
import { SELECTED_VERSIONS } from "./versions.js";
import {
  startBitbucket,
  type StartedBitbucket,
} from "./bitbucket-container.js";
import { bootstrap, type Scenario } from "./bootstrap.js";
import { setupMcpAgainst, type McpAgainstBitbucket } from "./mcp-harness.js";
import { callAndParse } from "../tool-test-utils.js";

describe.each(SELECTED_VERSIONS)("refs: Bitbucket $name", (version) => {
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

  test("list_branches returns main and feature", async () => {
    const parsed = await callAndParse<{
      total: number;
      branches: Array<{ displayId: string }>;
    }>(mcp.client, "list_branches", {
      project: s.projectKey,
      repository: s.repoSlug,
    });

    expect(parsed.total).toBeGreaterThanOrEqual(2);
    const ids = parsed.branches.map((b) => b.displayId);
    expect(ids).toContain("main");
    expect(ids).toContain("feature");
  });

  test("manage_branches create creates a new branch", async () => {
    const parsed = await callAndParse<{ displayId: string }>(
      mcp.client,
      "manage_branches",
      {
        action: "create",
        project: s.projectKey,
        repository: s.repoSlug,
        branch: "e2e-branch",
        startPoint: s.mainCommitId,
      },
    );

    expect(parsed.displayId).toBe("e2e-branch");
  });

  test("get_commit returns the main commit", async () => {
    const parsed = await callAndParse<{ id: string; message: string }>(
      mcp.client,
      "get_commit",
      {
        project: s.projectKey,
        repository: s.repoSlug,
        commitId: s.mainCommitId,
      },
    );

    expect(parsed.id).toBe(s.mainCommitId);
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
