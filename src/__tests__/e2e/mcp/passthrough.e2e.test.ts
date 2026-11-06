import { expect } from "vitest";
import { callAndParse, callRaw } from "../../fixtures/tool-test-utils.js";
import { test, describeBitbucket } from ".././e2e-suite.js";

describeBitbucket("call_bitbucket_api", () => {
  let projectKey: string;
  let repoSlug: string;
  let masterCommitId: string;

  test.beforeEach(async ({ scenario }) => {
    projectKey = scenario.project.key;
    repoSlug = scenario.project.repo.slug;
    masterCommitId = scenario.project.repo.masterCommitId;
  });

  test("GET returns the raw standard page over the full MCP round-trip", async ({
    mcp,
  }) => {
    const page = await callAndParse<{
      values: Array<{ key: string }>;
      size: number;
      isLastPage: boolean;
      start: number;
    }>(mcp.client, "call_bitbucket_api", {
      method: "GET",
      path: "/rest/api/1.0/projects?limit=100&start=0",
    });

    expect(page.values.some((p) => p.key === projectKey)).toBe(true);
    expect(page).toHaveProperty("isLastPage");
    expect(page).toHaveProperty("start");
  });

  test("404 surfaces the server error as an MCP error", async ({ mcp }) => {
    const before = await callRaw(mcp.client, "call_bitbucket_api", {
      method: "GET",
      path: "/rest/api/1.0/projects/NOPE/repos/nope",
    });

    expect(before.isError).toBe(true);
    expect(before.content[0].text).toContain("Project NOPE does not exist");
  });

  test("POST build status sticks and is readable back", async ({ mcp }) => {
    const created = await callAndParse(mcp.client, "call_bitbucket_api", {
      method: "POST",
      path: `/rest/build-status/1.0/commits/${masterCommitId}`,
      body: {
        state: "SUCCESSFUL",
        key: "e2e-passthrough",
        name: "e2e build",
        url: "http://localhost/e2e",
      },
    });
    expect(created).toBeNull();

    const read = await callAndParse<{
      values: Array<{ state: string; key: string }>;
    }>(mcp.client, "call_bitbucket_api", {
      method: "GET",
      path: `/rest/build-status/1.0/commits/${masterCommitId}`,
    });
    expect(read.values).toMatchObject([
      { state: "SUCCESSFUL", key: "e2e-passthrough" },
    ]);
  });

  test("POST branch via plugin endpoint creates the branch", async ({
    mcp,
  }) => {
    const created = await callAndParse<{ displayId: string }>(
      mcp.client,
      "call_bitbucket_api",
      {
        method: "POST",
        path: `/rest/branch-utils/1.0/projects/${projectKey}/repos/${repoSlug}/branches`,
        body: { name: "refs/heads/passthrough-e2e", startPoint: "master" },
      },
    );
    expect(created.displayId).toBe("passthrough-e2e");

    const branches = await callAndParse<{
      values: Array<{ displayId: string }>;
    }>(mcp.client, "call_bitbucket_api", {
      method: "GET",
      path: `/rest/api/1.0/projects/${projectKey}/repos/${repoSlug}/branches?limit=100`,
    });
    expect(branches.values.some((b) => b.displayId === "passthrough-e2e")).toBe(
      true,
    );
  });

  test("POST PR comment through the passthrough is visible in activities", async ({
    mcp,
    scenario,
  }) => {
    const prId = (await scenario.project.repo.pr).id;
    const comment = await callAndParse<{ id: number }>(
      mcp.client,
      "call_bitbucket_api",
      {
        method: "POST",
        path: `/rest/api/1.0/projects/${projectKey}/repos/${repoSlug}/pull-requests/${prId}/comments`,
        body: { text: "passthrough e2e comment" },
      },
    );
    expect(comment.id).toBeGreaterThan(0);

    const activities = await callAndParse<{
      values: Array<{ comment?: { text: string } }>;
    }>(mcp.client, "call_bitbucket_api", {
      method: "GET",
      path: `/rest/api/1.0/projects/${projectKey}/repos/${repoSlug}/pull-requests/${prId}/activities?fromType=COMMENT`,
    });
    expect(
      activities.values.some(
        (a) => a.comment?.text === "passthrough e2e comment",
      ),
    ).toBe(true);
  });

  test("absolute path is rejected locally without reaching the server", async ({
    mcp,
  }) => {
    const r = await callRaw(mcp.client, "call_bitbucket_api", {
      method: "GET",
      path: "http://evil.example.com/rest/api/1.0/projects",
    });
    expect(r.isError).toBe(true);
    expect(r.content[0].text).toContain(
      "path must be relative to the Bitbucket base URL",
    );
  });
});
