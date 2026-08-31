import { expect } from "vitest";
import { callAndParse } from "../tool-test-utils.js";
import { test, describeBitbucket } from "./e2e-suite.js";

describeBitbucket("forks", () => {
  test("list_forks returns data", async ({ mcp, scenario }) => {
    const r = await callAndParse<{ total: number }>(mcp.client, "list_forks", {
      project: scenario.projectKey,
      repository: scenario.repoSlug,
      limit: 1,
    });
    expect(typeof r.total).toBe("number");
  });

  test("fork_repository creates a fork", async ({ bb, mcp, scenario }) => {
    const forkName = "e2e-fork-" + Date.now();
    const r = await callAndParse<{ slug: string; project: { key: string } }>(
      mcp.client,
      "fork_repository",
      {
        project: scenario.projectKey,
        repository: scenario.repoSlug,
        name: forkName,
      },
    );
    await bb.api.delete(`projects/${r.project.key}/repos/${r.slug}`);
  });
});
