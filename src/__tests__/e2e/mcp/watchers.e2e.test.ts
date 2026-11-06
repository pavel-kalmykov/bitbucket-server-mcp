import { expect } from "vitest";
import { callAndParse, callRaw } from "../../fixtures/tool-test-utils.js";
import { describeBitbucket, test } from "../e2e-suite.js";

describeBitbucket("repository watching", () => {
  let repoArgs: { project: string; repository: string };

  test.beforeEach(async ({ scenario }) => {
    repoArgs = {
      project: scenario.project.key,
      repository: scenario.project.repo.slug,
    };
  });

  test("watch_repository answers watching true", async ({ mcp }) => {
    const parsed = await callAndParse(mcp.client, "watch_repository", repoArgs);

    expect(parsed).toEqual({ watching: true });
  });

  test("watching twice stays idempotent", async ({ mcp }) => {
    await callAndParse(mcp.client, "watch_repository", repoArgs);

    const parsed = await callAndParse(mcp.client, "watch_repository", repoArgs);

    expect(parsed).toEqual({ watching: true });
  });

  test("unwatch_repository answers watching false", async ({ mcp }) => {
    await callAndParse(mcp.client, "watch_repository", repoArgs);

    const parsed = await callAndParse(
      mcp.client,
      "unwatch_repository",
      repoArgs,
    );

    expect(parsed).toEqual({ watching: false });
  });

  test("unwatching twice stays idempotent", async ({ mcp }) => {
    await callAndParse(mcp.client, "watch_repository", repoArgs);
    await callAndParse(mcp.client, "unwatch_repository", repoArgs);

    const parsed = await callAndParse(
      mcp.client,
      "unwatch_repository",
      repoArgs,
    );

    expect(parsed).toEqual({ watching: false });
  });

  test("reports an error for a repository that does not exist", async ({
    mcp,
  }) => {
    const result = await callRaw(mcp.client, "watch_repository", {
      ...repoArgs,
      repository: "does-not-exist",
    });

    expect(result.isError).toBe(true);
    expect(result.content[0].text).toContain("does not exist");
  });
});
