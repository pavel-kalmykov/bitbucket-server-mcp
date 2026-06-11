import { describe, test, expect } from "vitest";
import { registerCommitCommentTools } from "../../tools/commit-comments.js";
import { mockJson, mockReject } from "../test-utils.js";
import {
  callAndParse,
  callRaw,
  expectCalledWithJson,
  setupToolHarness,
} from "../tool-test-utils.js";

describe("list_commit_comments", () => {
  const h = setupToolHarness({
    register: registerCommitCommentTools,
    defaultProject: "DEFAULT",
  });

  test("returns comments for a commit", async () => {
    mockJson(h.mockClients.api.get, {
      values: [
        {
          id: 1,
          text: "Looks good",
          author: { name: "jdoe" },
        },
      ],
      size: 1,
      isLastPage: true,
    });

    const parsed = await callAndParse<{
      total: number;
      comments: Array<{ id: number; text: string }>;
    }>(h.client, "list_commit_comments", {
      project: "TEST",
      repository: "my-repo",
      commitId: "abc123",
    });

    expect(parsed.total).toBe(1);
    expect(parsed.comments[0].text).toBe("Looks good");
    expect(h.mockClients.api.get).toHaveBeenCalledWith(
      "projects/TEST/repos/my-repo/commits/abc123/comments",
      expect.objectContaining({ searchParams: { limit: 25, start: 0 } }),
    );
  });

  test("returns empty list when no comments exist", async () => {
    mockJson(h.mockClients.api.get, {
      values: [],
      size: 0,
      isLastPage: true,
    });

    const parsed = await callAndParse<{ total: number }>(
      h.client,
      "list_commit_comments",
      {
        project: "TEST",
        repository: "my-repo",
        commitId: "abc123",
      },
    );

    expect(parsed.total).toBe(0);
  });

  test("returns error on API failure", async () => {
    mockReject(h.mockClients.api.get, new Error("Not found"));

    const result = await callRaw(h.client, "list_commit_comments", {
      project: "TEST",
      repository: "my-repo",
      commitId: "abc123",
    });

    expect(result.isError).toBe(true);
  });
});

describe("manage_commit_comments", () => {
  const h = setupToolHarness({
    register: registerCommitCommentTools,
    defaultProject: "DEFAULT",
  });

  test("creates a comment on a commit", async () => {
    mockJson(h.mockClients.api.post, { id: 1, text: "Nice work" });

    const parsed = await callAndParse<{ id: number; text: string }>(
      h.client,
      "manage_commit_comments",
      {
        action: "create",
        project: "TEST",
        repository: "my-repo",
        commitId: "abc123",
        text: "Nice work",
      },
    );

    expect(parsed.text).toBe("Nice work");
    expectCalledWithJson(
      h.mockClients.api.post,
      "projects/TEST/repos/my-repo/commits/abc123/comments",
      { text: "Nice work" },
    );
  });

  test("edits a comment on a commit", async () => {
    mockJson(h.mockClients.api.put, {
      id: 1,
      text: "Updated comment",
      version: 2,
    });

    const parsed = await callAndParse<{ text: string }>(
      h.client,
      "manage_commit_comments",
      {
        action: "edit",
        project: "TEST",
        repository: "my-repo",
        commitId: "abc123",
        commentId: 1,
        version: 1,
        text: "Updated comment",
      },
    );
    expect(parsed.text).toBe("Updated comment");
    expectCalledWithJson(
      h.mockClients.api.put,
      "projects/TEST/repos/my-repo/commits/abc123/comments/1",
      { text: "Updated comment", version: 1 },
    );
  });

  test("deletes a comment on a commit", async () => {
    mockJson(h.mockClients.api.delete, {});

    const parsed = await callAndParse<{ deleted: boolean; commentId: number }>(
      h.client,
      "manage_commit_comments",
      {
        action: "delete",
        project: "TEST",
        repository: "my-repo",
        commitId: "abc123",
        commentId: 1,
        version: 1,
      },
    );

    expect(parsed.deleted).toBe(true);
    expect(parsed.commentId).toBe(1);
    expect(h.mockClients.api.delete).toHaveBeenCalledWith(
      "projects/TEST/repos/my-repo/commits/abc123/comments/1",
      expect.objectContaining({ searchParams: { version: 1 } }),
    );
  });

  test.each([
    {
      action: "create" as const,
      mockMethod: "post" as const,
      extraArgs: { text: "comment" },
    },
    {
      action: "edit" as const,
      mockMethod: "put" as const,
      extraArgs: { commentId: 1, version: 1, text: "updated" },
    },
    {
      action: "delete" as const,
      mockMethod: "delete" as const,
      extraArgs: { commentId: 1, version: 1 },
    },
  ])(
    "returns error when $action fails",
    async ({ action, mockMethod, extraArgs }) => {
      mockReject(h.mockClients.api[mockMethod], new Error("fail"));
      const result = await callRaw(h.client, "manage_commit_comments", {
        action,
        project: "TEST",
        repository: "my-repo",
        commitId: "abc123",
        ...extraArgs,
      });
      expect(result.isError).toBe(true);
    },
  );
});
