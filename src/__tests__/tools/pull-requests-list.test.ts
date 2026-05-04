import { describe, test, expect } from "vitest";
import { registerPullRequestTools } from "../../tools/pull-requests.js";
import { mockJson } from "../test-utils.js";
import {
  callAndParse,
  expectCalledWithSearchParams,
  setupToolHarness,
} from "../tool-test-utils.js";

describe("Pull request tools", () => {
  const h = setupToolHarness({
    register: registerPullRequestTools,
    defaultProject: "DEFAULT",
    maxLinesPerFile: 5,
  });
  describe("list_pull_requests", () => {
    test("should list pull requests with filters", async () => {
      const mockResponse = {
        values: [
          {
            id: 1,
            title: "PR 1",
            author: {
              user: { name: "alice", slug: "alice", displayName: "Alice" },
            },
          },
          {
            id: 2,
            title: "PR 2",
            author: { user: { name: "bob", slug: "bob", displayName: "Bob" } },
          },
        ],
        size: 2,
        isLastPage: true,
      };

      mockJson(h.mockClients.api.get, mockResponse);

      const parsed = await callAndParse<{
        total: number;
        pullRequests: unknown[];
      }>(h.client, "list_pull_requests", {
        project: "PROJ",
        repository: "my-repo",
        state: "OPEN",
      });
      expect(parsed.total).toBe(2);
      expect(parsed.pullRequests).toHaveLength(2);
    });

    test("should filter by author client-side", async () => {
      const mockResponse = {
        values: [
          {
            id: 1,
            title: "PR 1",
            author: {
              user: { name: "alice", slug: "alice", displayName: "Alice" },
            },
          },
          {
            id: 2,
            title: "PR 2",
            author: { user: { name: "bob", slug: "bob", displayName: "Bob" } },
          },
        ],
        size: 2,
        isLastPage: true,
      };

      mockJson(h.mockClients.api.get, mockResponse);

      const parsed = await callAndParse<{
        total: number;
        pullRequests: Array<{ id: number }>;
      }>(h.client, "list_pull_requests", {
        project: "PROJ",
        repository: "my-repo",
        author: "alice",
      });
      expect(parsed.total).toBe(1);
      expect(parsed.pullRequests).toHaveLength(1);
      expect(parsed.pullRequests[0].id).toBe(1);
    });

    test("should match author by displayName substring (case-insensitive)", async () => {
      mockJson(h.mockClients.api.get, {
        values: [
          {
            id: 1,
            author: {
              user: {
                name: "jsmith",
                slug: "jsmith",
                displayName: "John Smith",
              },
            },
          },
          {
            id: 2,
            author: {
              user: { name: "alice", slug: "alice", displayName: "Alice" },
            },
          },
        ],
        size: 2,
        isLastPage: true,
      });

      const parsed = await callAndParse<{
        pullRequests: Array<{ id: number }>;
      }>(h.client, "list_pull_requests", {
        repository: "r",
        author: "john",
      });
      expect(parsed.pullRequests).toHaveLength(1);
      expect(parsed.pullRequests[0].id).toBe(1);
    });

    test("should exclude PRs without author when filtering by author", async () => {
      mockJson(h.mockClients.api.get, {
        values: [
          { id: 1, author: { user: { name: "alice" } } },
          { id: 2 },
          { id: 3, author: {} },
        ],
        size: 3,
        isLastPage: true,
      });

      const parsed = await callAndParse<{
        pullRequests: Array<{ id: number }>;
      }>(h.client, "list_pull_requests", {
        repository: "r",
        author: "alice",
      });
      expect(parsed.pullRequests).toHaveLength(1);
    });

    test("should match author by slug", async () => {
      mockJson(h.mockClients.api.get, {
        values: [
          {
            id: 1,
            author: {
              user: { name: "alice", slug: "alice-dev", displayName: "A" },
            },
          },
        ],
        size: 1,
        isLastPage: true,
      });

      const parsed = await callAndParse<{
        pullRequests: Array<{ id: number }>;
      }>(h.client, "list_pull_requests", {
        repository: "r",
        author: "alice-dev",
      });
      expect(parsed.pullRequests).toHaveLength(1);
    });
  });

  describe("list_pull_requests (each-value coverage of state/direction/order)", () => {
    test.each([
      { state: "OPEN", direction: "INCOMING", order: "NEWEST" },
      { state: "MERGED", direction: "OUTGOING", order: "OLDEST" },
      { state: "DECLINED", direction: "INCOMING", order: "NEWEST" },
      { state: "ALL", direction: "OUTGOING", order: "OLDEST" },
    ])("combines $state/$direction/$order", async (args) => {
      mockJson(h.mockClients.api.get, {
        values: [],
        size: 0,
        isLastPage: true,
      });

      await h.client.callTool({
        name: "list_pull_requests",
        arguments: { repository: "r", ...args },
      });

      expectCalledWithSearchParams(
        h.mockClients.api.get,
        expect.stringContaining("/pull-requests"),
        { state: args.state, direction: args.direction, order: args.order },
      );
    });

    test("sends withAttributes=false and withProperties=false by default", async () => {
      mockJson(h.mockClients.api.get, {
        values: [],
        size: 0,
        isLastPage: true,
      });

      await h.client.callTool({
        name: "list_pull_requests",
        arguments: { repository: "r" },
      });

      expectCalledWithSearchParams(
        h.mockClients.api.get,
        expect.stringContaining("/pull-requests"),
        { withAttributes: false, withProperties: false },
      );
    });
  });

  describe("pagination params forwarding (limit/start)", () => {
    test.each([
      { limit: 0, start: 0 },
      { limit: 1, start: 0 },
      { limit: 100, start: 1000 },
      { limit: 1000, start: 99999 },
    ])("list_pull_requests passes limit=$limit start=$start", async (args) => {
      mockJson(h.mockClients.api.get, {
        values: [],
        size: 0,
        isLastPage: true,
      });

      await h.client.callTool({
        name: "list_pull_requests",
        arguments: { repository: "r", ...args },
      });

      expectCalledWithSearchParams(
        h.mockClients.api.get,
        expect.any(String),
        args,
      );
    });
  });
});
