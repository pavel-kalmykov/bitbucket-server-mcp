import { describe, test, expect } from "vitest";
import { registerBranchTools } from "../../tools/branches.js";
import { mockJson } from "../test-utils.js";
import {
  callAndParse,
  callRaw,
  expectCalledWithSearchParams,
  setupToolHarness,
} from "../tool-test-utils.js";

describe("compare_refs", () => {
  const h = setupToolHarness({
    register: registerBranchTools,
    defaultProject: "DEFAULT",
  });

  test("returns commits between two refs", async () => {
    mockJson(h.mockClients.api.get, {
      values: [
        { id: "abc123", message: "Fix" },
        { id: "def456", message: "Feature" },
      ],
      size: 2,
      isLastPage: true,
    });

    const parsed = await callAndParse<{
      total: number;
      commits: Array<{ id: string }>;
    }>(h.client, "compare_refs", {
      project: "TEST",
      repository: "my-repo",
      from: "main",
      to: "feature/new",
    });

    expect(parsed.total).toBe(2);
    expect(parsed.commits).toHaveLength(2);

    expectCalledWithSearchParams(
      h.mockClients.api.get,
      "projects/TEST/repos/my-repo/compare/commits",
      { from: "main", to: "feature/new", limit: 25, start: 0 },
    );
  });

  test("omits refs from searchParams when not provided", async () => {
    mockJson(h.mockClients.api.get, {
      values: [],
      size: 0,
      isLastPage: true,
    });

    await callAndParse(h.client, "compare_refs", {
      project: "TEST",
      repository: "my-repo",
    });

    const callArgs = h.mockClients.api.get.mock.calls.find((c) =>
      String(c[0]).endsWith("/compare/commits"),
    );
    const searchParams = (
      callArgs![1] as { searchParams: Record<string, unknown> }
    ).searchParams;
    expect(searchParams.limit).toBe(25);
    expect(searchParams.start).toBe(0);
    expect(searchParams).not.toHaveProperty("from");
    expect(searchParams).not.toHaveProperty("to");
  });

  test("passes only from ref when to is omitted", async () => {
    mockJson(h.mockClients.api.get, {
      values: [],
      size: 0,
      isLastPage: true,
    });

    await callAndParse(h.client, "compare_refs", {
      project: "TEST",
      repository: "my-repo",
      from: "main",
    });

    expectCalledWithSearchParams(
      h.mockClients.api.get,
      "projects/TEST/repos/my-repo/compare/commits",
      { from: "main", limit: 25, start: 0 },
    );
  });

  test("passes only to ref when from is omitted", async () => {
    mockJson(h.mockClients.api.get, {
      values: [],
      size: 0,
      isLastPage: true,
    });

    await callAndParse(h.client, "compare_refs", {
      project: "TEST",
      repository: "my-repo",
      to: "feature/new",
    });

    expectCalledWithSearchParams(
      h.mockClients.api.get,
      "projects/TEST/repos/my-repo/compare/commits",
      { to: "feature/new", limit: 25, start: 0 },
    );
  });

  test("uses default project when not provided", async () => {
    mockJson(h.mockClients.api.get, {
      values: [],
      size: 0,
      isLastPage: true,
    });

    await callAndParse(h.client, "compare_refs", {
      repository: "my-repo",
    });

    expect(h.mockClients.api.get).toHaveBeenCalledWith(
      "projects/DEFAULT/repos/my-repo/compare/commits",
      expect.anything(),
    );
  });

  test("passes limit and start for pagination", async () => {
    mockJson(h.mockClients.api.get, {
      values: [],
      size: 0,
      isLastPage: true,
    });

    await callAndParse(h.client, "compare_refs", {
      project: "TEST",
      repository: "my-repo",
      from: "main",
      limit: 10,
      start: 50,
    });

    expectCalledWithSearchParams(
      h.mockClients.api.get,
      "projects/TEST/repos/my-repo/compare/commits",
      { from: "main", limit: 10, start: 50 },
    );
  });

  test("returns raw output when fields is '*all'", async () => {
    const commit = { id: "abc123", extra: "kept" };
    mockJson(h.mockClients.api.get, {
      values: [commit],
      size: 1,
      isLastPage: true,
    });

    const parsed = await callAndParse<{
      commits: Array<{ extra: string }>;
    }>(h.client, "compare_refs", {
      project: "TEST",
      repository: "my-repo",
      fields: "*all",
    });

    expect(parsed.commits[0].extra).toBe("kept");
  });

  test("returns custom fields subset when fields is provided", async () => {
    mockJson(h.mockClients.api.get, {
      values: [{ id: "abc123", message: "Fix", author: { name: "john" } }],
      size: 1,
      isLastPage: true,
    });

    const parsed = await callAndParse<{
      commits: Array<{ id: string; message: string }>;
    }>(h.client, "compare_refs", {
      project: "TEST",
      repository: "my-repo",
      fields: "id,message",
    });

    expect(parsed.commits[0].id).toBe("abc123");
    expect(parsed.commits[0].message).toBe("Fix");
    expect(parsed.commits[0]).not.toHaveProperty("author");
  });

  test("returns error when API call fails", async () => {
    h.mockClients.api.get.mockRejectedValueOnce(new Error("Comparison failed"));

    const result = await callRaw(h.client, "compare_refs", {
      project: "TEST",
      repository: "my-repo",
      from: "main",
      to: "nonexistent",
    });

    expect(result.isError).toBe(true);
  });
});
