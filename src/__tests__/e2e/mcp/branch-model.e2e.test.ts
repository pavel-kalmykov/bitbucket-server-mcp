import { expect } from "vitest";
import { callAndParse, callRaw } from "../../fixtures/tool-test-utils.js";
import { test, describeBitbucket } from "../e2e-suite.js";

describeBitbucket("branch model", () => {
  test("get_branch_model returns the default model of a fresh repo", async ({
    mcp,
    scenario,
  }) => {
    const r = await callAndParse<{
      development: { displayId: string; isDefault: boolean };
      types: Array<{ id: string }>;
    }>(mcp.client, "get_branch_model", {
      project: scenario.project.key,
      repository: scenario.project.repo.slug,
    });
    expect(r.development.displayId).toBe("master");
    expect(r.development.isDefault).toBe(true);
    const typeIds = r.types.map((t) => t.id);
    expect(typeIds).toContain("FEATURE");
    expect(typeIds).toContain("BUGFIX");
  });

  test("get_branch_model curates the response by default", async ({
    mcp,
    scenario,
  }) => {
    const r = await callAndParse<{
      development: Record<string, unknown>;
      types: Array<Record<string, unknown>>;
    }>(mcp.client, "get_branch_model", {
      project: scenario.project.key,
      repository: scenario.project.repo.slug,
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

  test("get_branch_model honors explicit fields", async ({ mcp, scenario }) => {
    const r = await callAndParse<Record<string, unknown>>(
      mcp.client,
      "get_branch_model",
      {
        project: scenario.project.key,
        repository: scenario.project.repo.slug,
        fields: "development.displayId",
      },
    );
    expect(Object.keys(r)).toEqual(["development"]);
    expect(r.development).toEqual({ displayId: "master" });
  });

  test("get_branch_model supports '*all'", async ({ mcp, scenario }) => {
    const r = await callAndParse<{
      development: Record<string, unknown>;
    }>(mcp.client, "get_branch_model", {
      project: scenario.project.key,
      repository: scenario.project.repo.slug,
      fields: "*all",
    });
    expect(r.development).toHaveProperty("latestChangeset");
  });

  test("get_branch_model on unknown repo surfaces the API error", async ({
    mcp,
    scenario,
  }) => {
    const result = await callRaw(mcp.client, "get_branch_model", {
      project: scenario.project.key,
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
