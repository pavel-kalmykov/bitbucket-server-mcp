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
        project: scenario.projectKey,
        repository: scenario.repoSlug,
        prId: scenario.prId,
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
      project: scenario.projectKey,
      repository: scenario.repoSlug,
    });
    const pr = r.pullRequests.find((p) => p.id === scenario.prId);
    expect(pr).toBeDefined();
    expect(pr!.properties).toBeDefined();
  });

  test("create_pull_request with draft:true", async ({ bb, mcp, scenario }) => {
    const form = new FormData();
    form.append("content", "draft\n");
    form.append("message", "draft branch");
    form.append("branch", "draft-br");
    form.append("sourceBranch", "main");
    await bb.api.put(
      `projects/${scenario.projectKey}/repos/${scenario.repoSlug}/browse/draft.md`,
      { body: form },
    );

    const r = await callAndParse<{ id: number }>(
      mcp.client,
      "create_pull_request",
      {
        project: scenario.projectKey,
        repository: scenario.repoSlug,
        title: "Draft PR " + Date.now(),
        sourceBranch: "draft-br",
        targetBranch: "main",
        draft: true,
      },
    );
    const pr = await bb.api
      .get(
        `projects/${scenario.projectKey}/repos/${scenario.repoSlug}/pull-requests/${r.id}`,
      )
      .json<{ version: number }>();
    await bb.api
      .post(
        `projects/${scenario.projectKey}/repos/${scenario.repoSlug}/pull-requests/${r.id}/decline`,
        { json: { version: pr.version } },
      )
      .catch(() => {});
  });
});

describeBitbucket(
  "pull request comment count",
  () => {
    test("list_pull_requests reports commentCount in properties", async ({
      mcp,
      scenario,
    }) => {
      const r = await callAndParse<{
        pullRequests: Array<{
          id: number;
          properties?: { commentCount?: unknown };
        }>;
      }>(mcp.client, "list_pull_requests", {
        project: scenario.projectKey,
        repository: scenario.repoSlug,
      });
      const pr = r.pullRequests.find((p) => p.id === scenario.prId);
      expect(typeof pr!.properties!.commentCount).toBe("number");
    });
  },
  atLeast(PR_COMMENT_COUNT_SINCE),
);
