import { test, expect } from "vitest";
import { callAndParse } from "../tool-test-utils.js";
import { describeBitbucket } from "./e2e-suite.js";

describeBitbucket("forks", ({ bb, mcp, s }) => {
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
