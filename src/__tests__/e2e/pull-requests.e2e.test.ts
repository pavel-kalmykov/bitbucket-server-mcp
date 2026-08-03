import { test, expect } from "vitest";
import { callAndParse } from "../tool-test-utils.js";
import { describeBitbucket } from "./e2e-suite.js";

describeBitbucket("pull requests", ({ bb, mcp, s }) => {
  test("get_pull_request_commits returns data", async () => {
    const r = await callAndParse<{ total: number }>(
      mcp.client,
      "get_pull_request_commits",
      {
        project: s.projectKey,
        repository: s.repoSlug,
        prId: s.prId,
        limit: 1,
      },
    );
    expect(typeof r.total).toBe("number");
  });

  test("list_pull_requests returns PR properties in the curated output", async () => {
    const r = await callAndParse<{
      pullRequests: Array<{
        id: number;
        properties?: { commentCount?: unknown };
      }>;
    }>(mcp.client, "list_pull_requests", {
      project: s.projectKey,
      repository: s.repoSlug,
    });
    const pr = r.pullRequests.find((p) => p.id === s.prId);
    expect(pr).toBeDefined();
    expect(pr!.properties).toBeDefined();
    expect(typeof pr!.properties!.commentCount).toBe("number");
  });

  test("create_pull_request with draft:true", async () => {
    const form = new FormData();
    form.append("content", "draft\n");
    form.append("message", "draft branch");
    form.append("branch", "draft-br");
    form.append("sourceBranch", "main");
    await bb.api.put(
      `projects/${s.projectKey}/repos/${s.repoSlug}/browse/draft.md`,
      { body: form },
    );

    const r = await callAndParse<{ id: number }>(
      mcp.client,
      "create_pull_request",
      {
        project: s.projectKey,
        repository: s.repoSlug,
        title: "Draft PR " + Date.now(),
        sourceBranch: "draft-br",
        targetBranch: "main",
        draft: true,
      },
    );
    const pr = await bb.api
      .get(`projects/${s.projectKey}/repos/${s.repoSlug}/pull-requests/${r.id}`)
      .json<{ version: number }>();
    await bb.api
      .post(
        `projects/${s.projectKey}/repos/${s.repoSlug}/pull-requests/${r.id}/decline`,
        { json: { version: pr.version } },
      )
      .catch(() => {});
  });
});
