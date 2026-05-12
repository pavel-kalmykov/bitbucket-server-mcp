import { describe, test, expect } from "vitest";
import { registerPullRequestTools } from "../../tools/pull-requests.js";
import { mockJson } from "../test-utils.js";
import {
  callAndParse,
  callRaw,
  expectCalledWithSearchParams,
  setupToolHarness,
} from "../tool-test-utils.js";

describe("get_pull_request_commits", () => {
  const h = setupToolHarness({
    register: registerPullRequestTools,
    defaultProject: "DEFAULT",
  });

  test("returns commits for a pull request", async () => {
    mockJson(h.mockClients.api.get, {
      values: [
        {
          id: "abc123",
          displayId: "abc1234",
          message: "Fix bug",
          author: { name: "jdoe" },
        },
      ],
      size: 1,
      isLastPage: true,
    });

    const parsed = await callAndParse<{
      total: number;
      commits: Array<{ id: string; message: string }>;
    }>(h.client, "get_pull_request_commits", {
      project: "TEST",
      repository: "my-repo",
      prId: 1,
    });

    expect(parsed.total).toBe(1);
    expect(parsed.commits[0].message).toBe("Fix bug");
  });

  test("passes limit and start as search params", async () => {
    mockJson(h.mockClients.api.get, {
      values: [],
      size: 0,
      isLastPage: true,
    });

    await callAndParse(h.client, "get_pull_request_commits", {
      project: "TEST",
      repository: "my-repo",
      prId: 1,
      limit: 10,
      start: 5,
    });

    expectCalledWithSearchParams(
      h.mockClients.api.get,
      "projects/TEST/repos/my-repo/pull-requests/1/commits",
      { limit: 10, start: 5 },
    );
  });

  test("returns empty list when no commits exist", async () => {
    mockJson(h.mockClients.api.get, {
      values: [],
      size: 0,
      isLastPage: true,
    });

    const parsed = await callAndParse<{ total: number }>(
      h.client,
      "get_pull_request_commits",
      {
        project: "TEST",
        repository: "my-repo",
        prId: 1,
      },
    );

    expect(parsed.total).toBe(0);
  });

  test("returns error when API call fails", async () => {
    h.mockClients.api.get.mockRejectedValueOnce(new Error("Not found"));

    const result = await callRaw(h.client, "get_pull_request_commits", {
      project: "TEST",
      repository: "my-repo",
      prId: 1,
    });

    expect(result.isError).toBe(true);
  });
});
