import { describe, test, expect } from "vitest";
import { registerReviewerGroupTools } from "../../tools/reviewer-groups.js";
import { BitbucketApiError } from "../../api/http/errors.js";
import { mockError, mockJson, mockReject, mockVoid } from "../test-utils.js";
import {
  callAndParse,
  callRaw,
  expectCalledWithJson,
  setupToolHarness,
} from "../tool-test-utils.js";

describe("list_reviewer_groups", () => {
  const h = setupToolHarness({
    register: registerReviewerGroupTools,
    defaultProject: "D",
  });

  test("returns reviewer groups", async () => {
    mockJson(h.mockClients.api.get, {
      values: [{ name: "seniors", description: "Senior devs" }],
    });
    const parsed = await callAndParse<Array<{ name: string }>>(
      h.client,
      "list_reviewer_groups",
      { project: "P", repository: "r" },
    );
    expect(parsed[0].name).toBe("seniors");
    expect(h.mockClients.api.get).toHaveBeenCalledWith(
      "projects/P/repos/r/settings/reviewer-groups",
    );
  });

  test("curates default fields", async () => {
    mockJson(h.mockClients.api.get, {
      values: [
        {
          id: 7,
          name: "seniors",
          description: "Senior devs",
          users: [{ id: 2, name: "admin", displayName: "Admin" }],
          avatarUrl: "https://bitbucket.test/avatar",
        },
      ],
    });
    const parsed = await callAndParse<Array<Record<string, unknown>>>(
      h.client,
      "list_reviewer_groups",
      { project: "P", repository: "r" },
    );
    expect(parsed[0]).toEqual({
      id: 7,
      name: "seniors",
      description: "Senior devs",
      users: [{ name: "admin" }],
    });
  });

  test("returns empty array", async () => {
    mockJson(h.mockClients.api.get, { values: [] });
    const parsed = await callAndParse<unknown[]>(
      h.client,
      "list_reviewer_groups",
      { project: "P", repository: "r" },
    );
    expect(parsed).toHaveLength(0);
  });

  test("API error", async () => {
    mockReject(h.mockClients.api.get, new Error("fail"));
    const r = await callRaw(h.client, "list_reviewer_groups", {
      project: "P",
      repository: "r",
    });
    expect(r.isError).toBe(true);
  });
});

describe("create_reviewer_group", () => {
  const h = setupToolHarness({
    register: registerReviewerGroupTools,
    defaultProject: "D",
  });

  test("resolves reviewer names to user ids", async () => {
    mockJson(h.mockClients.api.get, { id: 2, name: "admin" });
    mockJson(h.mockClients.api.post, { id: 1, name: "team-a" });
    const parsed = await callAndParse<{ name: string }>(
      h.client,
      "create_reviewer_group",
      {
        project: "P",
        repository: "r",
        name: "team-a",
        description: "Team A",
        reviewers: ["admin"],
      },
    );
    expect(parsed.name).toBe("team-a");
    expect(h.mockClients.api.get).toHaveBeenCalledWith("users/admin");
    expectCalledWithJson(
      h.mockClients.api.post,
      "projects/P/repos/r/settings/reviewer-groups",
      {
        name: "team-a",
        description: "Team A",
        users: [{ id: 2 }],
      },
    );
  });

  test("resolves multiple reviewers in order", async () => {
    mockJson(h.mockClients.api.get, { id: 11 });
    mockJson(h.mockClients.api.get, { id: 22 });
    mockJson(h.mockClients.api.post, { id: 1, name: "team-a" });
    await callAndParse(h.client, "create_reviewer_group", {
      project: "P",
      repository: "r",
      name: "team-a",
      reviewers: ["alice", "bob"],
    });
    expect(h.mockClients.api.get).toHaveBeenNthCalledWith(1, "users/alice");
    expect(h.mockClients.api.get).toHaveBeenNthCalledWith(2, "users/bob");
    expectCalledWithJson(
      h.mockClients.api.post,
      "projects/P/repos/r/settings/reviewer-groups",
      {
        name: "team-a",
        users: [{ id: 11 }, { id: 22 }],
      },
    );
  });

  test("rejects a missing reviewer list before any request", async () => {
    const r = await callRaw(h.client, "create_reviewer_group", {
      project: "P",
      repository: "r",
      name: "solo",
    });
    expect(r.isError).toBe(true);
    expect(h.mockClients.api.get).not.toHaveBeenCalled();
    expect(h.mockClients.api.post).not.toHaveBeenCalled();
  });

  test("rejects an empty reviewer list", async () => {
    const r = await callRaw(h.client, "create_reviewer_group", {
      project: "P",
      repository: "r",
      name: "solo",
      reviewers: [],
    });
    expect(r.isError).toBe(true);
    expect(h.mockClients.api.post).not.toHaveBeenCalled();
  });

  test("names the reviewer when the user does not exist", async () => {
    mockError(
      h.mockClients.api.get,
      new BitbucketApiError({
        message: "User alice does not exist",
        status: 404,
        url: "https://bitbucket.test/users/alice",
        body: null,
      }),
    );
    const r = await callRaw(h.client, "create_reviewer_group", {
      project: "P",
      repository: "r",
      name: "team-a",
      reviewers: ["alice"],
    });
    expect(r.isError).toBe(true);
    expect(r.content[0].text).toContain('Reviewer "alice" does not exist');
  });

  test("re-raises non-404 lookup errors unchanged", async () => {
    mockError(
      h.mockClients.api.get,
      new BitbucketApiError({
        message: "Internal server error",
        status: 500,
        url: "https://bitbucket.test/users/alice",
        body: null,
      }),
    );
    const r = await callRaw(h.client, "create_reviewer_group", {
      project: "P",
      repository: "r",
      name: "team-a",
      reviewers: ["alice"],
    });
    expect(r.isError).toBe(true);
    expect(r.content[0].text).toContain("Internal server error");
    expect(r.content[0].text).not.toContain('Reviewer "alice" does not exist');
  });

  test("surfaces API errors", async () => {
    mockJson(h.mockClients.api.get, { id: 1 });
    mockReject(h.mockClients.api.post, new Error("fail"));
    const r = await callRaw(h.client, "create_reviewer_group", {
      project: "P",
      repository: "r",
      name: "x",
      reviewers: ["alice"],
    });
    expect(r.isError).toBe(true);
  });

  test("creates with default project when omitted", async () => {
    mockJson(h.mockClients.api.get, { id: 2 });
    mockJson(h.mockClients.api.post, { name: "g" });
    await callAndParse(h.client, "create_reviewer_group", {
      repository: "r",
      name: "g",
      reviewers: ["admin"],
    });
    expect(h.mockClients.api.post).toHaveBeenCalledWith(
      "projects/D/repos/r/settings/reviewer-groups",
      expect.anything(),
    );
  });
});

describe("delete_reviewer_group", () => {
  const h = setupToolHarness({
    register: registerReviewerGroupTools,
    defaultProject: "D",
  });

  test("resolves the group id from the name", async () => {
    mockJson(h.mockClients.api.get, {
      values: [{ id: 7, name: "team-a", description: "Team A" }],
    });
    mockVoid(h.mockClients.api.delete);
    const parsed = await callAndParse<{ deleted: boolean; name: string }>(
      h.client,
      "delete_reviewer_group",
      { project: "P", repository: "r", name: "team-a" },
    );
    expect(parsed.deleted).toBe(true);
    expect(h.mockClients.api.delete).toHaveBeenCalledWith(
      "projects/P/repos/r/settings/reviewer-groups/7",
    );
  });

  test("fails when no group has the name", async () => {
    mockJson(h.mockClients.api.get, { values: [] });
    const r = await callRaw(h.client, "delete_reviewer_group", {
      project: "P",
      repository: "r",
      name: "ghost",
    });
    expect(r.isError).toBe(true);
    expect(r.content[0].text).toContain('No reviewer group named "ghost"');
  });

  test("surfaces API errors", async () => {
    mockJson(h.mockClients.api.get, { values: [{ id: 7, name: "x" }] });
    mockReject(h.mockClients.api.delete, new Error("fail"));
    const r = await callRaw(h.client, "delete_reviewer_group", {
      project: "P",
      repository: "r",
      name: "x",
    });
    expect(r.isError).toBe(true);
  });
});
