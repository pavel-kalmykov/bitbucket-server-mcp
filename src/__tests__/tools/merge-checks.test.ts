import { describe, test, expect } from "vitest";
import { registerMergeCheckTools } from "../../tools/merge-checks.js";
import { mockError, mockJson, mockReject } from "../test-utils.js";
import {
  callAndParse,
  callRaw,
  expectCalledWithJson,
  setupToolHarness,
} from "../tool-test-utils.js";

describe("list_merge_checks", () => {
  const h = setupToolHarness({
    register: registerMergeCheckTools,
    defaultProject: "D",
  });

  test("returns merge check hooks with settings", async () => {
    mockJson(h.mockClients.api.get, {
      values: [
        {
          key: "com.atlassian.bitbucket.server.bitbucket-build.requiredBuildsMergeCheck",
          enabled: false,
          details: {
            type: "PRE_PULL_REQUEST_MERGE",
            name: "Required Builds Merge Check",
            description: "Requires builds to pass",
          },
        },
        {
          key: "com.atlassian.bitbucket.server.bitbucket-bundled-hooks:force-push-hook",
          enabled: false,
          details: { type: "PRE_RECEIVE", name: "Force Push Hook" },
        },
      ],
    });
    mockJson(h.mockClients.api.get, { requiredBuildsCount: 0 });

    const parsed = await callAndParse<
      Array<{
        key: string;
        name?: string;
        description?: string;
        enabled: boolean;
      }>
    >(h.client, "list_merge_checks", { project: "P", repository: "r" });
    expect(parsed.length).toBe(1);
    expect(parsed[0].key).toBe(
      "com.atlassian.bitbucket.server.bitbucket-build.requiredBuildsMergeCheck",
    );
    expect(parsed[0].name).toBe("Required Builds Merge Check");
    expect(parsed[0].description).toBe("Requires builds to pass");
    expect(h.mockClients.api.get).toHaveBeenCalledWith(
      "projects/P/repos/r/settings/hooks",
    );
    expect(h.mockClients.api.get).toHaveBeenCalledWith(
      "projects/P/repos/r/settings/hooks/com.atlassian.bitbucket.server.bitbucket-build.requiredBuildsMergeCheck/settings",
    );
  });

  test("returns empty when no merge checks configured", async () => {
    mockJson(h.mockClients.api.get, {
      values: [{ key: "some-hook", enabled: false }],
    });

    const parsed = await callAndParse<unknown[]>(
      h.client,
      "list_merge_checks",
      { project: "P", repository: "r" },
    );
    expect(parsed).toHaveLength(0);
  });

  test("handles settings fetch failure gracefully", async () => {
    mockJson(h.mockClients.api.get, {
      values: [
        {
          key: "com.atlassian.bitbucket.server.bitbucket-build.requiredBuildsMergeCheck",
          enabled: false,
          details: { type: "PRE_PULL_REQUEST_MERGE" },
        },
      ],
    });
    mockError(h.mockClients.api.get, new Error("not found"));

    const parsed = await callAndParse<
      Array<{ settings: Record<string, unknown> }>
    >(h.client, "list_merge_checks", { project: "P", repository: "r" });
    expect(parsed[0].settings).toEqual({});
  });

  test("API error on hooks list", async () => {
    mockReject(h.mockClients.api.get, new Error("fail"));
    const r = await callRaw(h.client, "list_merge_checks", {
      project: "P",
      repository: "r",
    });
    expect(r.isError).toBe(true);
  });
});

describe("manage_merge_checks", () => {
  const h = setupToolHarness({
    register: registerMergeCheckTools,
    defaultProject: "D",
  });

  test("configures merge check with settings", async () => {
    mockJson(h.mockClients.api.put, { requiredBuildsCount: 2 });
    const parsed = await callAndParse<{ requiredBuildsCount: number }>(
      h.client,
      "manage_merge_checks",
      {
        project: "P",
        repository: "r",
        hookKey:
          "com.atlassian.bitbucket.server.bitbucket-build.requiredBuildsMergeCheck",
        settings: { requiredBuildsCount: 2 },
      },
    );
    expect(parsed.requiredBuildsCount).toBe(2);
    expectCalledWithJson(
      h.mockClients.api.put,
      "projects/P/repos/r/settings/hooks/com.atlassian.bitbucket.server.bitbucket-build.requiredBuildsMergeCheck/settings",
      { requiredBuildsCount: 2 },
    );
  });

  test("API error on configure", async () => {
    mockReject(h.mockClients.api.put, new Error("fail"));
    const r = await callRaw(h.client, "manage_merge_checks", {
      project: "P",
      repository: "r",
      hookKey: "hk",
      settings: { x: 1 },
    });
    expect(r.isError).toBe(true);
  });
});
