import { expect } from "vitest";
import { callAndParse, callRaw } from "../../fixtures/tool-test-utils.js";
import { commitFile, test, describeBitbucket } from ".././e2e-suite.js";
import { atLeast, PR_COMMENT_COUNT_SINCE } from ".././versions.js";

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
    await commitFile(
      bb,
      scenario.project.key,
      scenario.project.repo.slug,
      "draft-br",
      "draft.md",
      "draft\n",
      "draft branch",
      "master",
    );

    const r = await callAndParse<{ id: number }>(
      mcp.client,
      "create_pull_request",
      {
        project: scenario.project.key,
        repository: scenario.project.repo.slug,
        title: "Draft PR " + Date.now(),
        sourceBranch: "draft-br",
        targetBranch: "master",
        draft: true,
      },
    );
    const { version } = await bb.api
      .get(
        `projects/${scenario.project.key}/repos/${scenario.project.repo.slug}/pull-requests/${r.id}`,
      )
      .json<{ version: number }>();
    await bb.api
      .post(
        `projects/${scenario.project.key}/repos/${scenario.project.repo.slug}/pull-requests/${r.id}/decline`,
        { json: { version } },
      )
      .catch((error: unknown) => {
        console.error("cleanup decline failed:", String(error).slice(0, 120));
      });
  });
});

describeBitbucket("pull request reopen", () => {
  test("reopen_pull_request restores a declined PR", async ({
    bb,
    mcp,
    scenario,
  }) => {
    const projectKey = scenario.project.key;
    const repoSlug = scenario.project.repo.slug;
    await commitFile(
      bb,
      projectKey,
      repoSlug,
      "reopen-e1-br",
      "reopen-e1.md",
      "reopen-e1\n",
      "reopen-e1 branch",
      "master",
    );

    const created = await callAndParse<{ id: number }>(
      mcp.client,
      "create_pull_request",
      {
        project: projectKey,
        repository: repoSlug,
        title: "Reopen PR " + Date.now(),
        sourceBranch: "reopen-e1-br",
        targetBranch: "master",
      },
    );

    const versionAtCreate = await bb.api
      .get(
        `projects/${projectKey}/repos/${repoSlug}/pull-requests/${created.id}`,
      )
      .json<{ version: number }>()
      .then((r) => r.version);

    const declined = await callAndParse<{ state: string }>(
      mcp.client,
      "decline_pull_request",
      { project: projectKey, repository: repoSlug, prId: created.id },
    );
    expect(declined.state).toBe("DECLINED");

    const reopened = await callAndParse<{ state: string }>(
      mcp.client,
      "reopen_pull_request",
      { project: projectKey, repository: repoSlug, prId: created.id },
    );
    expect(reopened.state).toBe("OPEN");

    // Decline and reopen each bump the version by one over the freshly
    // created PR's version (captured before the decline).
    const current = await bb.api
      .get(
        `projects/${projectKey}/repos/${repoSlug}/pull-requests/${created.id}`,
      )
      .json<{ state: string; version: number }>();
    expect(current.state).toBe("OPEN");
    expect(current.version).toBeGreaterThanOrEqual(versionAtCreate + 2);

    const listed = await callAndParse<{
      pullRequests: Array<{ id: number }>;
    }>(mcp.client, "list_pull_requests", {
      project: projectKey,
      repository: repoSlug,
      state: "OPEN",
    });
    expect(listed.pullRequests.some((p) => p.id === created.id)).toBe(true);

    // Cleanup, not part of the test: a decline failure only leaves an
    // open PR in the ephemeral container.
    await callAndParse(mcp.client, "decline_pull_request", {
      project: projectKey,
      repository: repoSlug,
      prId: created.id,
    }).catch((error: unknown) => {
      console.error("cleanup decline failed:", String(error).slice(0, 120));
    });
  });

  test("reopen_pull_request rejects an open PR", async ({
    bb,
    mcp,
    scenario,
  }) => {
    const projectKey = scenario.project.key;
    const repoSlug = scenario.project.repo.slug;
    await commitFile(
      bb,
      projectKey,
      repoSlug,
      "reopen-e2-br",
      "reopen-e2.md",
      "reopen-e2\n",
      "reopen-e2 branch",
      "master",
    );

    const created = await callAndParse<{ id: number }>(
      mcp.client,
      "create_pull_request",
      {
        project: projectKey,
        repository: repoSlug,
        title: "Reopen E2 PR " + Date.now(),
        sourceBranch: "reopen-e2-br",
        targetBranch: "master",
      },
    );

    const result = await callRaw(mcp.client, "reopen_pull_request", {
      project: projectKey,
      repository: repoSlug,
      prId: created.id,
    });
    expect(result.isError).toBe(true);

    // Cleanup, not part of the test: a decline failure only leaves an
    // open PR in the ephemeral container.
    await callAndParse(mcp.client, "decline_pull_request", {
      project: projectKey,
      repository: repoSlug,
      prId: created.id,
    }).catch((error: unknown) => {
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
