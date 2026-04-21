import { describe, test, expect } from "vitest";
import { registerCommentTools } from "../../tools/comments.js";
import { mockJson, mockVoid } from "../test-utils.js";
import {
  callAndParse,
  expectCalledWithJson,
  expectCalledWithSearchParams,
  setupToolHarness,
} from "../tool-test-utils.js";

describe("Comment tools", () => {
  const h = setupToolHarness({
    register: registerCommentTools,
    defaultProject: "DEFAULT",
  });

  const commentUrl = "projects/DEFAULT/repos/my-repo/pull-requests/42/comments";

  describe("manage_comment", () => {
    test("should create a general comment", async () => {
      const mockResponse = { id: 1, text: "Looks good!", version: 0 };

      mockJson(h.mockClients.api.post, mockResponse);

      const parsed = await callAndParse<{ id: number; text: string }>(
        h.client,
        "manage_comment",
        {
          action: "create",
          repository: "my-repo",
          prId: "42",
          text: "Looks good!",
        },
      );

      expect(parsed.id).toBe(1);
      expect(parsed.text).toBe("Looks good!");
      expectCalledWithJson(h.mockClients.api.post, commentUrl, {
        text: "Looks good!",
      });
    });

    test("create without optional fields omits them from serialized body", async () => {
      mockJson(h.mockClients.api.post, { id: 10, text: "minimal" });

      await h.client.callTool({
        name: "manage_comment",
        arguments: {
          action: "create",
          repository: "my-repo",
          prId: 42,
          text: "minimal",
        },
      });

      const json = (
        h.mockClients.api.post.mock.calls[0][1] as {
          json: Record<string, unknown>;
        }
      ).json;
      const serialized = JSON.stringify(json);
      expect(serialized).not.toContain("parent");
      expect(serialized).not.toContain("severity");
      expect(serialized).not.toContain("anchor");
    });

    test("create with parentId includes parent in body", async () => {
      mockJson(h.mockClients.api.post, { id: 11, text: "reply" });

      await h.client.callTool({
        name: "manage_comment",
        arguments: {
          action: "create",
          repository: "my-repo",
          prId: 42,
          text: "reply",
          parentId: 5,
        },
      });

      expectCalledWithJson(h.mockClients.api.post, commentUrl, {
        parent: { id: 5 },
      });
    });

    test("should create a draft comment with state PENDING", async () => {
      const mockResponse = {
        id: 2,
        text: "Draft note",
        state: "PENDING",
        version: 0,
      };

      mockJson(h.mockClients.api.post, mockResponse);

      const parsed = await callAndParse<{ state: string }>(
        h.client,
        "manage_comment",
        {
          action: "create",
          repository: "my-repo",
          prId: 42,
          text: "Draft note",
          state: "PENDING",
        },
      );

      expect(parsed.state).toBe("PENDING");
      expectCalledWithJson(h.mockClients.api.post, commentUrl, {
        text: "Draft note",
        state: "PENDING",
      });
    });

    test("should create an inline comment with filePath, line, and lineType", async () => {
      const mockResponse = {
        id: 3,
        text: "Inline note",
        version: 0,
        anchor: { path: "src/main.ts", line: 10, lineType: "ADDED" },
      };

      mockJson(h.mockClients.api.post, mockResponse);

      const parsed = await callAndParse<{ anchor: { path: string } }>(
        h.client,
        "manage_comment",
        {
          action: "create",
          repository: "my-repo",
          prId: 42,
          text: "Inline note",
          filePath: "src/main.ts",
          line: 10,
          lineType: "ADDED",
        },
      );

      expect(parsed.anchor.path).toBe("src/main.ts");
      expectCalledWithJson(h.mockClients.api.post, commentUrl, {
        text: "Inline note",
        anchor: {
          path: "src/main.ts",
          lineType: "ADDED",
          line: 10,
          diffType: "EFFECTIVE",
          fileType: "TO",
        },
      });
    });

    test("should create inline comment with custom diffType, fileType, and lineType", async () => {
      const mockResponse = {
        id: 6,
        text: "Old version issue",
        anchor: {
          path: "old.ts",
          diffType: "COMMIT",
          fileType: "FROM",
          lineType: "CONTEXT",
        },
        version: 0,
      };

      mockJson(h.mockClients.api.post, mockResponse);

      const result = await h.client.callTool({
        name: "manage_comment",
        arguments: {
          action: "create",
          repository: "my-repo",
          prId: 42,
          text: "Old version issue",
          filePath: "old.ts",
          line: 5,
          lineType: "CONTEXT",
          diffType: "COMMIT",
          fileType: "FROM",
        },
      });

      expect(result.isError).toBeFalsy();

      expectCalledWithJson(h.mockClients.api.post, commentUrl, {
        anchor: {
          path: "old.ts",
          lineType: "CONTEXT",
          line: 5,
          diffType: "COMMIT",
          fileType: "FROM",
        },
      });
    });

    test("should default diffType and fileType when not provided", async () => {
      const mockResponse = {
        id: 7,
        text: "Default anchor",
        anchor: {},
        version: 0,
      };

      mockJson(h.mockClients.api.post, mockResponse);

      await h.client.callTool({
        name: "manage_comment",
        arguments: {
          action: "create",
          repository: "my-repo",
          prId: 42,
          text: "Default anchor",
          filePath: "src/index.ts",
          line: 1,
          lineType: "ADDED",
        },
      });

      expect(h.mockClients.api.post).toHaveBeenCalledWith(
        expect.any(String),
        expect.objectContaining({
          json: expect.objectContaining({
            anchor: expect.objectContaining({
              diffType: "EFFECTIVE",
              fileType: "TO",
            }),
          }),
        }),
      );
    });

    test("should create a task comment with severity BLOCKER", async () => {
      const mockResponse = {
        id: 4,
        text: "Fix this",
        severity: "BLOCKER",
        version: 0,
      };

      mockJson(h.mockClients.api.post, mockResponse);

      const parsed = await callAndParse<{ severity: string }>(
        h.client,
        "manage_comment",
        {
          action: "create",
          repository: "my-repo",
          prId: 42,
          text: "Fix this",
          severity: "BLOCKER",
        },
      );

      expect(parsed.severity).toBe("BLOCKER");
      expectCalledWithJson(h.mockClients.api.post, commentUrl, {
        text: "Fix this",
        severity: "BLOCKER",
      });
    });

    test("should edit a comment", async () => {
      const mockResponse = { id: 1, text: "Updated text", version: 1 };

      mockJson(h.mockClients.api.put, mockResponse);

      const parsed = await callAndParse<{ text: string; version: number }>(
        h.client,
        "manage_comment",
        {
          action: "edit",
          repository: "my-repo",
          prId: 42,
          commentId: 1,
          text: "Updated text",
          version: 0,
        },
      );

      expect(parsed.text).toBe("Updated text");
      expect(parsed.version).toBe(1);
      expectCalledWithJson(h.mockClients.api.put, `${commentUrl}/1`, {
        text: "Updated text",
        version: 0,
      });
    });

    test("edit without state/severity omits them from body", async () => {
      mockJson(h.mockClients.api.put, {
        id: 1,
        text: "clean edit",
        version: 1,
      });

      await h.client.callTool({
        name: "manage_comment",
        arguments: {
          action: "edit",
          repository: "my-repo",
          prId: 42,
          commentId: 1,
          version: 0,
          text: "clean edit",
        },
      });

      const body = (
        h.mockClients.api.put.mock.calls[0][1] as {
          json: Record<string, unknown>;
        }
      ).json;
      expect(body).not.toHaveProperty("severity");
      expect(body).not.toHaveProperty("state");
    });

    test("should resolve a comment", async () => {
      const mockResponse = {
        id: 1,
        text: "Fix this",
        state: "RESOLVED",
        version: 1,
      };

      mockJson(h.mockClients.api.put, mockResponse);

      const parsed = await callAndParse<{ state: string }>(
        h.client,
        "manage_comment",
        {
          action: "edit",
          repository: "my-repo",
          prId: 42,
          commentId: 1,
          version: 0,
          state: "RESOLVED",
        },
      );

      expect(parsed.state).toBe("RESOLVED");
      expectCalledWithJson(h.mockClients.api.put, `${commentUrl}/1`, {
        state: "RESOLVED",
        version: 0,
      });
    });

    test("should delete a comment", async () => {
      mockVoid(h.mockClients.api.delete);

      const parsed = await callAndParse<{
        deleted: boolean;
        commentId: number;
      }>(h.client, "manage_comment", {
        action: "delete",
        repository: "my-repo",
        prId: 42,
        commentId: 1,
        version: 0,
      });

      expect(parsed.deleted).toBe(true);
      expect(parsed.commentId).toBe(1);
      expect(h.mockClients.api.delete).toHaveBeenCalledWith(`${commentUrl}/1`, {
        searchParams: { version: 0 },
      });
    });
  });

  describe("manage_comment state field propagation", () => {
    test("PENDING -> OPEN via edit with state update", async () => {
      mockJson(h.mockClients.api.put, {
        id: 1,
        text: "now visible",
        state: "OPEN",
      });

      await h.client.callTool({
        name: "manage_comment",
        arguments: {
          action: "edit",
          repository: "r",
          prId: 1,
          commentId: 1,
          version: 0,
          text: "now visible",
          state: "OPEN",
        },
      });

      expectCalledWithJson(
        h.mockClients.api.put,
        "projects/DEFAULT/repos/r/pull-requests/1/comments/1",
        { state: "OPEN" },
      );
    });

    test("OPEN -> RESOLVED -> OPEN cycle uses PUT with correct state", async () => {
      mockJson(h.mockClients.api.put, { id: 1, state: "RESOLVED" });
      await h.client.callTool({
        name: "manage_comment",
        arguments: {
          action: "edit",
          repository: "r",
          prId: 1,
          commentId: 1,
          version: 0,
          state: "RESOLVED",
        },
      });
      await h.client.callTool({
        name: "manage_comment",
        arguments: {
          action: "edit",
          repository: "r",
          prId: 1,
          commentId: 1,
          version: 1,
          state: "OPEN",
        },
      });

      expect(h.mockClients.api.put).toHaveBeenCalledTimes(2);
      const firstCall = h.mockClients.api.put.mock.calls[0][1] as {
        json: Record<string, unknown>;
      };
      const secondCall = h.mockClients.api.put.mock.calls[1][1] as {
        json: Record<string, unknown>;
      };
      expect(firstCall.json.state).toBe("RESOLVED");
      expect(firstCall.json.version).toBe(0);
      expect(secondCall.json.state).toBe("OPEN");
      expect(secondCall.json.version).toBe(1);
    });

    test("create-as-PENDING then edit to OPEN sends PENDING on POST and OPEN on PUT", async () => {
      mockJson(h.mockClients.api.post, { id: 99, state: "PENDING" });
      mockJson(h.mockClients.api.put, { id: 99, state: "OPEN" });

      await h.client.callTool({
        name: "manage_comment",
        arguments: {
          action: "create",
          repository: "r",
          prId: 1,
          text: "draft",
          state: "PENDING",
        },
      });
      await h.client.callTool({
        name: "manage_comment",
        arguments: {
          action: "edit",
          repository: "r",
          prId: 1,
          commentId: 99,
          version: 0,
          state: "OPEN",
        },
      });

      expect(h.mockClients.api.post).toHaveBeenCalledTimes(1);
      expect(h.mockClients.api.put).toHaveBeenCalledTimes(1);
      const postBody = (
        h.mockClients.api.post.mock.calls[0][1] as {
          json: Record<string, unknown>;
        }
      ).json;
      const putBody = (
        h.mockClients.api.put.mock.calls[0][1] as {
          json: Record<string, unknown>;
        }
      ).json;
      expect(postBody.state).toBe("PENDING");
      expect(putBody.state).toBe("OPEN");
    });
  });

  describe("manage_comment threadResolved propagation (decision table)", () => {
    // `threadResolved` is a separate dimension from `state` / `severity`.
    // The edit handler must (a) forward the value verbatim when set,
    // (b) omit the key entirely when the caller does not provide one,
    // and (c) tolerate being combined with other mutations in a single
    // PUT. Each row locks one of those contracts.
    test.each<{
      label: string;
      extra: Record<string, unknown>;
      expectedBody: Record<string, unknown>;
    }>([
      {
        label: "true",
        extra: { threadResolved: true },
        // `text` is always present (set to undefined when the caller
        // omits it) because the handler initialises the body object
        // with it; only `threadResolved` / `state` / `severity` are
        // spread-conditionally.
        expectedBody: { text: undefined, version: 0, threadResolved: true },
      },
      {
        label: "false",
        extra: { threadResolved: false },
        expectedBody: { text: undefined, version: 0, threadResolved: false },
      },
      {
        label: "omitted",
        extra: {},
        expectedBody: { text: undefined, version: 0 },
      },
    ])(
      "threadResolved=$label produces the expected PUT body",
      async ({ extra, expectedBody }) => {
        mockJson(h.mockClients.api.put, { id: 1, version: 1 });

        await h.client.callTool({
          name: "manage_comment",
          arguments: {
            action: "edit",
            repository: "my-repo",
            prId: 42,
            commentId: 1,
            version: 0,
            ...extra,
          },
        });

        const actualBody = (
          h.mockClients.api.put.mock.calls[0][1] as {
            json: Record<string, unknown>;
          }
        ).json;
        // `toStrictEqual` (not `toEqual`) is required so that an
        // `{threadResolved: undefined}` body does not silently pass the
        // "omitted" row; Vitest's `toEqual` ignores undefined properties,
        // which would let a `!==` → `===` mutation in the edit handler
        // survive.
        expect(actualBody).toStrictEqual(expectedBody);
      },
    );

    test("state: RESOLVED and threadResolved: true combine in one PUT body", async () => {
      mockJson(h.mockClients.api.put, { id: 1, version: 1 });

      await h.client.callTool({
        name: "manage_comment",
        arguments: {
          action: "edit",
          repository: "my-repo",
          prId: 42,
          commentId: 1,
          version: 0,
          state: "RESOLVED",
          threadResolved: true,
        },
      });

      expectCalledWithJson(h.mockClients.api.put, `${commentUrl}/1`, {
        state: "RESOLVED",
        threadResolved: true,
        version: 0,
      });
    });
  });

  describe("manage_comment react/unreact", () => {
    test("react returns { react: true, commentId, emoticon }", async () => {
      mockVoid(h.mockClients.commentLikes.put);

      const result = await h.client.callTool({
        name: "manage_comment",
        arguments: {
          action: "react",
          repository: "r",
          prId: 1,
          commentId: 5,
          emoticon: "thumbsup",
        },
      });

      expect(h.mockClients.commentLikes.put).toHaveBeenCalledWith(
        expect.stringContaining("/comments/5/reactions/thumbsup"),
      );
      const parsed = JSON.parse(
        (result.content as Array<{ text: string }>)[0].text,
      );
      expect(parsed).toEqual({
        react: true,
        commentId: 5,
        emoticon: "thumbsup",
      });
    });

    test("unreact returns { unreact: true, commentId, emoticon }", async () => {
      mockVoid(h.mockClients.commentLikes.delete);

      const result = await h.client.callTool({
        name: "manage_comment",
        arguments: {
          action: "unreact",
          repository: "r",
          prId: 1,
          commentId: 5,
          emoticon: "thumbsup",
        },
      });

      expect(h.mockClients.commentLikes.delete).toHaveBeenCalledWith(
        expect.stringContaining("/comments/5/reactions/thumbsup"),
      );
      const parsed = JSON.parse(
        (result.content as Array<{ text: string }>)[0].text,
      );
      expect(parsed).toEqual({
        unreact: true,
        commentId: 5,
        emoticon: "thumbsup",
      });
    });
  });

  describe("search_emoticons", () => {
    test("returns list of matching emoticon shortcuts", async () => {
      mockJson(h.mockClients.emoticons.get, {
        values: [
          { shortcut: "thumbsup", displayName: "Thumbs up" },
          { shortcut: "thumbsdown", displayName: "Thumbs down" },
        ],
      });

      const parsed = await callAndParse<string[]>(
        h.client,
        "search_emoticons",
        {
          query: "thumbs",
        },
      );
      expect(parsed).toEqual(["thumbsup", "thumbsdown"]);
    });

    test("passes query as search param", async () => {
      mockJson(h.mockClients.emoticons.get, { values: [] });

      await h.client.callTool({
        name: "search_emoticons",
        arguments: { query: "heart" },
      });

      expectCalledWithSearchParams(h.mockClients.emoticons.get, "search", {
        query: "heart",
      });
    });

    test("returns empty list when no matches", async () => {
      mockJson(h.mockClients.emoticons.get, { values: [] });

      const parsed = await callAndParse<string[]>(
        h.client,
        "search_emoticons",
        {
          query: "xyz",
        },
      );
      expect(parsed).toEqual([]);
    });
  });
});
