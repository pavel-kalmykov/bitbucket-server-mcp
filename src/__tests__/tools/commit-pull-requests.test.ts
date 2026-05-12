import { describe, test, expect } from "vitest";
import { registerPullRequestTools } from "../../tools/pull-requests.js";
import { mockJson } from "../test-utils.js";
import {
  callAndParse,
  callRaw,
  expectCalledWithSearchParams,
  setupToolHarness,
} from "../tool-test-utils.js";

describe("get_commit_pull_requests", () => {
  const h = setupToolHarness({
    register: registerPullRequestTools,
    defaultProject: "DEFAULT",
  });

  test("returns PRs containing the commit", async () => {
    mockJson(h.mockClients.api.get, {
      values: [{ id: 1, title: "Fix bug" }],
      size: 1,
      isLastPage: true,
    });
    const parsed = await callAndParse<{ total: number }>(
      h.client,
      "get_commit_pull_requests",
      { project: "TEST", repository: "my-repo", commitId: "abc123" },
    );
    expect(parsed.total).toBe(1);
  });

  test("returns empty list", async () => {
    mockJson(h.mockClients.api.get, {
      values: [],
      size: 0,
      isLastPage: true,
    });
    const parsed = await callAndParse<{ total: number }>(
      h.client,
      "get_commit_pull_requests",
      { project: "TEST", repository: "my-repo", commitId: "abc123" },
    );
    expect(parsed.total).toBe(0);
  });

  test("returns isLastPage false for multi-page", async () => {
    mockJson(h.mockClients.api.get, {
      values: [{ id: 1 }],
      size: 100,
      isLastPage: false,
    });
    const parsed = await callAndParse<{ isLastPage: boolean }>(
      h.client,
      "get_commit_pull_requests",
      { project: "TEST", repository: "my-repo", commitId: "abc123" },
    );
    expect(parsed.isLastPage).toBe(false);
  });

  test("passes limit and start", async () => {
    mockJson(h.mockClients.api.get, { values: [], size: 0, isLastPage: true });
    await callAndParse(h.client, "get_commit_pull_requests", {
      project: "TEST",
      repository: "my-repo",
      commitId: "abc123",
      limit: 10,
      start: 5,
    });
    expectCalledWithSearchParams(
      h.mockClients.api.get,
      "projects/TEST/repos/my-repo/commits/abc123/pull-requests",
      { limit: 10, start: 5 },
    );
  });

  test("uses default project", async () => {
    mockJson(h.mockClients.api.get, { values: [], size: 0, isLastPage: true });
    await callAndParse(h.client, "get_commit_pull_requests", {
      repository: "my-repo",
      commitId: "abc123",
    });
    expect(h.mockClients.api.get).toHaveBeenCalledWith(
      "projects/DEFAULT/repos/my-repo/commits/abc123/pull-requests",
      expect.anything(),
    );
  });

  test("returns error on API failure", async () => {
    h.mockClients.api.get.mockRejectedValueOnce(new Error("Not found"));
    const result = await callRaw(h.client, "get_commit_pull_requests", {
      project: "TEST",
      repository: "my-repo",
      commitId: "abc123",
    });
    expect(result.isError).toBe(true);
  });
});

describe("create_pull_request draft", () => {
  const h = setupToolHarness({
    register: registerPullRequestTools,
    defaultProject: "DEFAULT",
  });

  function mockRepo() {
    mockJson(h.mockClients.api.get, {
      id: 1,
      slug: "r",
      project: { key: "P" },
    });
    mockJson(h.mockClients.api.post, { id: 1, title: "PR" });
  }

  test("draft:true in body", async () => {
    mockRepo();
    await callAndParse(h.client, "create_pull_request", {
      project: "TEST",
      repository: "my-repo",
      title: "PR",
      sourceBranch: "f",
      targetBranch: "m",
      draft: true,
    });
    expect(h.mockClients.api.post).toHaveBeenCalledWith(
      expect.anything(),
      expect.objectContaining({
        json: expect.objectContaining({ draft: true }),
      }),
    );
  });

  test("draft omitted from body", async () => {
    mockRepo();
    await callAndParse(h.client, "create_pull_request", {
      project: "TEST",
      repository: "my-repo",
      title: "PR",
      sourceBranch: "f",
      targetBranch: "m",
    });
    expect(h.mockClients.api.post).toHaveBeenCalledWith(
      expect.anything(),
      expect.objectContaining({
        json: expect.objectContaining({ draft: undefined }),
      }),
    );
  });

  test("draft:false in body", async () => {
    mockRepo();
    await callAndParse(h.client, "create_pull_request", {
      project: "TEST",
      repository: "my-repo",
      title: "PR",
      sourceBranch: "f",
      targetBranch: "m",
      draft: false,
    });
    expect(h.mockClients.api.post).toHaveBeenCalledWith(
      expect.anything(),
      expect.objectContaining({
        json: expect.objectContaining({ draft: false }),
      }),
    );
  });
});
