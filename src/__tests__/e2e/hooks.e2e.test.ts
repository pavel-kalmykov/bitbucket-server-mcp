import { test, expect } from "vitest";
import { callAndParse } from "../tool-test-utils.js";
import { describeBitbucket } from "./e2e-suite.js";

describeBitbucket("hooks", ({ mcp, s: scenario }) => {
  test("manage_repository_hooks enable flips a bundled hook", async () => {
    const parsed = await callAndParse<{ enabled: boolean; hookKey: string }>(
      mcp.client,
      "manage_repository_hooks",
      {
        action: "enable",
        project: scenario.projectKey,
        repository: scenario.repoSlug,
        hookKey:
          "com.atlassian.bitbucket.server.bitbucket-bundled-hooks:force-push-hook",
      },
    );

    expect(parsed.enabled).toBe(true);
  });

  test("manage_repository_hooks disable flips it back", async () => {
    const parsed = await callAndParse<{ enabled: boolean; hookKey: string }>(
      mcp.client,
      "manage_repository_hooks",
      {
        action: "disable",
        project: scenario.projectKey,
        repository: scenario.repoSlug,
        hookKey:
          "com.atlassian.bitbucket.server.bitbucket-bundled-hooks:force-push-hook",
      },
    );

    expect(parsed.enabled).toBe(false);
  });
});
