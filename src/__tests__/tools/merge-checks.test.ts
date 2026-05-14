import { describe, test, expect } from "vitest";
import { registerMergeCheckTools } from "../../tools/merge-checks.js";
import { fakeResponse, mockJson } from "../test-utils.js";
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
        },
        {
          key: "com.atlassian.bitbucket.server.bitbucket-bundled-hooks:force-push-hook",
          enabled: false,
        },
      ],
    });
    mockJson(h.mockClients.api.get, { requiredBuildsCount: 0 });

    const parsed = await callAndParse<Array<{ key: string; enabled: boolean }>>(
      h.client,
      "list_merge_checks",
      { project: "P", repository: "r" },
    );
    expect(parsed.length).toBe(1);
    expect(parsed[0].key.toLowerCase()).toMatch(/merge|requiredbuilds/);
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
    h.mockClients.api.get.mockReturnValueOnce(
      fakeResponse({
        json: () =>
          Promise.resolve({
            values: [
              {
                key: "com.atlassian.bitbucket.server.bitbucket-build.requiredBuildsMergeCheck",
                enabled: false,
              },
            ],
          }),
      }),
    );
    h.mockClients.api.get.mockReturnValueOnce(
      fakeResponse({ json: () => Promise.reject(new Error("not found")) }),
    );

    const parsed = await callAndParse<
      Array<{ settings: Record<string, unknown> }>
    >(h.client, "list_merge_checks", { project: "P", repository: "r" });
    expect(parsed[0].settings).toEqual({});
  });

  test("API error on hooks list", async () => {
    h.mockClients.api.get.mockRejectedValueOnce(new Error("fail"));
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
    h.mockClients.api.put.mockRejectedValueOnce(new Error("fail"));
    const r = await callRaw(h.client, "manage_merge_checks", {
      project: "P",
      repository: "r",
      hookKey: "hk",
      settings: { x: 1 },
    });
    expect(r.isError).toBe(true);
  });
});
