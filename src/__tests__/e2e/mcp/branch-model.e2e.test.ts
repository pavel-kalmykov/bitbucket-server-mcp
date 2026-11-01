import { expect } from "vitest";
import { callAndParse, callRaw } from "../../fixtures/tool-test-utils.js";
import type { StartedBitbucket } from "../bitbucket-container.js";
import { test, describeBitbucket } from "../e2e-suite.js";

/**
 * A fresh repo's factory default branch is "master" while the suite fixture
 * commits on "main", so the branch-utils plugin refuses to build the model
 * (NoDefaultBranchException) until the default branch points at the ref
 * that exists. Arranged over the raw REST contract, like all fixture setup.
 */
async function pointDefaultBranchAtMain(
  bb: StartedBitbucket,
  projectKey: string,
  repoSlug: string,
): Promise<void> {
  await bb.api.put(`projects/${projectKey}/repos/${repoSlug}/default-branch`, {
    json: { id: "refs/heads/main" },
  });
}

describeBitbucket("branch model", () => {
  let projectKey: string;
  let repoSlug: string;

  test.beforeEach(async ({ bb, scenario }) => {
    projectKey = scenario.project.key;
    repoSlug = scenario.project.repo.slug;
    await pointDefaultBranchAtMain(bb, projectKey, repoSlug);
  });

  test("get_branch_model returns the default model of a fresh repo", async ({
    mcp,
  }) => {
    const r = await callAndParse<{
      development: { displayId: string; isDefault: boolean };
      types: Array<{ id: string }>;
    }>(mcp.client, "get_branch_model", {
      project: projectKey,
      repository: repoSlug,
    });
    expect(r.development.displayId).toBe("main");
    expect(r.development.isDefault).toBe(true);
    const typeIds = r.types.map((t) => t.id);
    expect(typeIds).toContain("FEATURE");
    expect(typeIds).toContain("BUGFIX");
  });

  test("get_branch_model curates the response by default", async ({ mcp }) => {
    const r = await callAndParse<{
      development: Record<string, unknown>;
      types: Array<Record<string, unknown>>;
    }>(mcp.client, "get_branch_model", {
      project: projectKey,
      repository: repoSlug,
    });
    expect(Object.keys(r.development).sort()).toEqual([
      "displayId",
      "id",
      "isDefault",
      "latestCommit",
    ]);
    for (const type of r.types) {
      expect(Object.keys(type).sort()).toEqual(["displayName", "id", "prefix"]);
    }
  });

  test("get_branch_model honors explicit fields", async ({ mcp }) => {
    const r = await callAndParse<Record<string, unknown>>(
      mcp.client,
      "get_branch_model",
      {
        project: projectKey,
        repository: repoSlug,
        fields: "development.displayId",
      },
    );
    expect(Object.keys(r)).toEqual(["development"]);
    expect(r.development).toEqual({ displayId: "main" });
  });

  test("get_branch_model supports '*all'", async ({ mcp }) => {
    const r = await callAndParse<{
      development: Record<string, unknown>;
    }>(mcp.client, "get_branch_model", {
      project: projectKey,
      repository: repoSlug,
      fields: "*all",
    });
    expect(r.development).toHaveProperty("latestChangeset");
  });

  test("get_branch_model on unknown repo surfaces the API error", async ({
    mcp,
  }) => {
    const result = await callRaw(mcp.client, "get_branch_model", {
      project: projectKey,
      repository: "does-not-exist",
    });
    expect(result.isError).toBe(true);
    expect(
      result.content.some(
        (c) => c.type === "text" && /404|not exist/i.test(c.text),
      ),
    ).toBe(true);
  });
});
