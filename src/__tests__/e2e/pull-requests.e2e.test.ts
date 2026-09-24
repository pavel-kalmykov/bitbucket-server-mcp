import { expect } from "vitest";
import { callAndParse } from "../tool-test-utils.js";
import { test, describeBitbucket } from "./e2e-suite.js";
import { atLeast, PR_COMMENT_COUNT_SINCE } from "./versions.js";

describeBitbucket("pull requests", () => {
  test("get_pull_request_commits returns data", async ({ mcp, scenario }) => {
    const r = await callAndParse<{ total: number }>(
      mcp.client,
      "get_pull_request_commits",
      {
        project: scenario.project.key,
        repository: scenario.project.repo.slug,
        prId: (await scenario.project.repo.pr).id,
        limit: 1,
      },
    );
    expect(typeof r.total).toBe("number");
  });

  test("list_pull_requests returns PR properties in the curated output", async ({
    mcp,
    scenario,
  }) => {
    const r = await callAndParse<{
      pullRequests: Array<{
        id: number;
        properties?: { commentCount?: unknown };
      }>;
    }>(mcp.client, "list_pull_requests", {
      project: scenario.project.key,
      repository: scenario.project.repo.slug,
    });
    const prId = (await scenario.project.repo.pr).id;
    const found = r.pullRequests.find((p) => p.id === prId);
    expect(found).toBeDefined();
    expect(found!.properties).toBeDefined();
  });

  test("create_pull_request with draft:true", async ({ bb, mcp, scenario }) => {
    // Raw REST on purpose: arrange stays independent of the client under
    // test (rationale in e2e-suite.ts, commitFile).
    const form = new FormData();
    form.append("content", "draft\n");
    form.append("message", "draft branch");
    form.append("branch", "draft-br");
    form.append("sourceBranch", "main");
    await bb.api.put(
      `projects/${scenario.project.key}/repos/${scenario.project.repo.slug}/browse/draft.md`,
      { body: form },
    );

    const r = await callAndParse<{ id: number }>(
      mcp.client,
      "create_pull_request",
      {
        project: scenario.project.key,
        repository: scenario.project.repo.slug,
        title: "Draft PR " + Date.now(),
        sourceBranch: "draft-br",
        targetBranch: "main",
        draft: true,
      },
    );
    const created = await bb.api
      .get(
        `projects/${scenario.project.key}/repos/${scenario.project.repo.slug}/pull-requests/${r.id}`,
      )
      .json<{ version: number }>();
    await bb.api
      .post(
        `projects/${scenario.project.key}/repos/${scenario.project.repo.slug}/pull-requests/${r.id}/decline`,
        { json: { version: created.version } },
      )
      .catch((error: unknown) => {
        console.error("cleanup decline failed:", String(error).slice(0, 120));
      });
  });
});

describeBitbucket(
  "pull request comment count",
  () => {
    test("list_pull_requests reports commentCount in properties", async ({
      mcp,
      scenario,
    }) => {
      // Await the pr before listing: the lazy fixture provisions it on
      // demand, and the listing must observe it.
      const prId = (await scenario.project.repo.pr).id;
      const r = await callAndParse<{
        pullRequests: Array<{
          id: number;
          properties?: { commentCount?: unknown };
        }>;
      }>(mcp.client, "list_pull_requests", {
        project: scenario.project.key,
        repository: scenario.project.repo.slug,
      });
      const found = r.pullRequests.find((p) => p.id === prId);
      expect(typeof found!.properties!.commentCount).toBe("number");
    });
  },
  atLeast(PR_COMMENT_COUNT_SINCE),
);
