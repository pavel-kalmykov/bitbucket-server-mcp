import { expect } from "vitest";
import { callAndParse } from "../../fixtures/tool-test-utils.js";
import { test, describeBitbucket } from ".././e2e-suite.js";

describeBitbucket("hooks", () => {
  test("list_repository_hooks curates the response", async ({
    mcp,
    scenario,
  }) => {
    const parsed = await callAndParse<{
      hooks: Array<Record<string, unknown>>;
    }>(mcp.client, "list_repository_hooks", {
      project: scenario.project.key,
      repository: scenario.project.repo.slug,
      fields: "details.key,enabled",
    });
    for (const hook of parsed.hooks) {
      expect(Object.keys(hook).sort()).toEqual(["details", "enabled"]);
      expect(Object.keys(hook.details as Record<string, unknown>)).toEqual([
        "key",
      ]);
    }
  });

  test("manage_repository_hooks enable flips a bundled hook", async ({
    mcp,
    scenario,
  }) => {
    const parsed = await callAndParse<{ enabled: boolean; hookKey: string }>(
      mcp.client,
      "manage_repository_hooks",
      {
        action: "enable",
        project: scenario.project.key,
        repository: scenario.project.repo.slug,
        hookKey:
          "com.atlassian.bitbucket.server.bitbucket-bundled-hooks:force-push-hook",
      },
    );

    expect(parsed.enabled).toBe(true);
  });

  test("manage_repository_hooks disable flips it back", async ({
    mcp,
    scenario,
  }) => {
    const parsed = await callAndParse<{ enabled: boolean; hookKey: string }>(
      mcp.client,
      "manage_repository_hooks",
      {
        action: "disable",
        project: scenario.project.key,
        repository: scenario.project.repo.slug,
        hookKey:
          "com.atlassian.bitbucket.server.bitbucket-bundled-hooks:force-push-hook",
      },
    );

    expect(parsed.enabled).toBe(false);
  });
});
