import { describe, test, expect, beforeAll, afterAll } from "vitest";
import {
  startBitbucket,
  type StartedBitbucket,
} from "./bitbucket-container.js";
import { bootstrap, type Scenario } from "./bootstrap.js";
import { setupMcpAgainst, type McpAgainstBitbucket } from "./mcp-harness.js";
import { callAndParse } from "../tool-test-utils.js";
import { SELECTED_VERSIONS } from "./versions.js";

describe.each(SELECTED_VERSIONS)("forks: Bitbucket $name", (version) => {
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

  test("list_forks returns data", async () => {
    const r = await callAndParse<{ total: number }>(mcp.client, "list_forks", {
      project: s.projectKey,
      repository: s.repoSlug,
      limit: 1,
    });
    expect(typeof r.total).toBe("number");
  });

  test("fork_repository creates a fork", async () => {
    const forkName = "e2e-fork-" + Date.now();
    const r = await callAndParse<{ slug: string; project: { key: string } }>(
      mcp.client,
      "fork_repository",
      { project: s.projectKey, repository: s.repoSlug, name: forkName },
    );
    await bb.api.delete(`projects/${r.project.key}/repos/${r.slug}`);
  });
});
