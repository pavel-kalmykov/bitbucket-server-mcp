import { describe, test, expect } from "vitest";
import { registerBranchTools } from "../../tools/branches.js";
import { fakeResponse, mockJson, mockVoid } from "../test-utils.js";
import {
  callAndParse,
  callRaw,
  expectCalledWith,
  expectCalledWithSearchParams,
  setupToolHarness,
} from "../tool-test-utils.js";

describe("Branch tools", () => {
  const h = setupToolHarness({
    register: registerBranchTools,
    defaultProject: "DEFAULT",
  });

  describe("list_branches", () => {
    test("should list branches and include default branch", async () => {
      const branchesResponse = {
        values: [
          { displayId: "main", id: "refs/heads/main", isDefault: true },
          { displayId: "develop", id: "refs/heads/develop", isDefault: false },
        ],
        size: 2,
        isLastPage: true,
      };
      const defaultBranchResponse = {
        displayId: "main",
        id: "refs/heads/main",
      };

      h.mockClients.api.get
        .mockReturnValueOnce(
          fakeResponse({ json: () => Promise.resolve(branchesResponse) }),
        )
        .mockReturnValueOnce(
          fakeResponse({ json: () => Promise.resolve(defaultBranchResponse) }),
        );

      const parsed = await callAndParse<{
        total: number;
        branches: Array<{ displayId: string }>;
        defaultBranch: { displayId: string };
      }>(h.client, "list_branches", {
        project: "TEST",
        repository: "my-repo",
      });

      expect(parsed.total).toBe(2);
      expect(parsed.branches).toHaveLength(2);
      expect(parsed.branches[0].displayId).toBe("main");
      expect(parsed.defaultBranch.displayId).toBe("main");
    });

    test("should use default project when not provided", async () => {
      h.mockClients.api.get
        .mockReturnValueOnce(
          fakeResponse({
            json: () =>
              Promise.resolve({ values: [], size: 0, isLastPage: true }),
          }),
        )
        .mockReturnValueOnce(
          fakeResponse({ json: () => Promise.resolve(null) }),
        );

      await callAndParse(h.client, "list_branches", { repository: "my-repo" });

      expect(h.mockClients.api.get).toHaveBeenCalledWith(
        "projects/DEFAULT/repos/my-repo/branches",
        expect.anything(),
      );
    });

    test("should return raw output when fields is '*all'", async () => {
      const branchesResponse = {
        values: [
          {
            displayId: "main",
            id: "refs/heads/main",
            isDefault: true,
            type: "BRANCH",
            latestCommit: "abc123",
            metadata: { someKey: "someValue" },
            extraField: "should be kept",
          },
        ],
        size: 1,
        isLastPage: true,
      };
      const defaultBranchResponse = {
        displayId: "main",
        id: "refs/heads/main",
        extraField: "also kept",
      };

      h.mockClients.api.get
        .mockReturnValueOnce(
          fakeResponse({ json: () => Promise.resolve(branchesResponse) }),
        )
        .mockReturnValueOnce(
          fakeResponse({ json: () => Promise.resolve(defaultBranchResponse) }),
        );

      const parsed = await callAndParse<{
        branches: Array<{ extraField: string }>;
        defaultBranch: { extraField: string };
      }>(h.client, "list_branches", {
        project: "TEST",
        repository: "my-repo",
        fields: "*all",
      });

      expect(parsed.branches[0].extraField).toBe("should be kept");
      expect(parsed.defaultBranch.extraField).toBe("also kept");
    });

    test("should handle default branch fetch failure gracefully", async () => {
      const branchesResponse = {
        values: [{ displayId: "main", id: "refs/heads/main" }],
        size: 1,
        isLastPage: true,
      };

      h.mockClients.api.get
        .mockReturnValueOnce(
          fakeResponse({ json: () => Promise.resolve(branchesResponse) }),
        )
        .mockReturnValueOnce(
          fakeResponse({ json: () => Promise.reject(new Error("Not found")) }),
        );

      const parsed = await callAndParse<{
        total: number;
        defaultBranch: unknown;
      }>(h.client, "list_branches", { project: "TEST", repository: "my-repo" });

      expect(parsed.total).toBe(1);
      expect(parsed.defaultBranch).toBeNull();
    });
  });

  describe("list_commits", () => {
    test("should list commits for a branch", async () => {
      const mockResponse = {
        values: [
          {
            id: "abc123",
            message: "Initial commit",
            author: { name: "john", displayName: "John Doe", slug: "jdoe" },
          },
          {
            id: "def456",
            message: "Second commit",
            author: { name: "jane", displayName: "Jane Smith", slug: "jsmith" },
          },
        ],
        size: 2,
        isLastPage: true,
      };

      mockJson(h.mockClients.api.get, mockResponse);

      const parsed = await callAndParse<{
        total: number;
        commits: Array<{ id: string }>;
      }>(h.client, "list_commits", {
        project: "TEST",
        repository: "my-repo",
        branch: "main",
      });

      expect(parsed.total).toBe(2);
      expect(parsed.commits).toHaveLength(2);
      expect(parsed.commits[0].id).toBe("abc123");

      expectCalledWithSearchParams(
        h.mockClients.api.get,
        "projects/TEST/repos/my-repo/commits",
        { until: "main", limit: 25, start: 0 },
      );
    });

    test("should filter commits by author (case-insensitive)", async () => {
      const mockResponse = {
        values: [
          {
            id: "abc123",
            message: "First",
            author: { name: "john", displayName: "John Doe", slug: "jdoe" },
          },
          {
            id: "def456",
            message: "Second",
            author: { name: "jane", displayName: "Jane Smith", slug: "jsmith" },
          },
        ],
        size: 2,
        isLastPage: true,
      };

      mockJson(h.mockClients.api.get, mockResponse);

      const parsed = await callAndParse<{
        total: number;
        commits: Array<{ id: string }>;
      }>(h.client, "list_commits", {
        project: "TEST",
        repository: "my-repo",
        author: "JOHN",
      });

      expect(parsed.total).toBe(1);
      expect(parsed.commits).toHaveLength(1);
      expect(parsed.commits[0].id).toBe("abc123");
    });

    test("should use default project when not provided", async () => {
      mockJson(h.mockClients.api.get, {
        values: [],
        size: 0,
        isLastPage: true,
      });

      await callAndParse(h.client, "list_commits", { repository: "my-repo" });

      expect(h.mockClients.api.get).toHaveBeenCalledWith(
        "projects/DEFAULT/repos/my-repo/commits",
        expect.anything(),
      );
    });
  });

  describe("manage_branches", () => {
    describe("create", () => {
      test("creates a branch with startPoint", async () => {
        mockJson(h.mockClients.branchUtils.post, {
          id: "refs/heads/feature/new",
          displayId: "feature/new",
        });

        const parsed = await callAndParse<{
          id: string;
          displayId: string;
        }>(h.client, "manage_branches", {
          action: "create",
          project: "TEST",
          repository: "my-repo",
          branch: "feature/new",
          startPoint: "main",
        });

        expect(parsed.displayId).toBe("feature/new");

        expect(h.mockClients.branchUtils.post).toHaveBeenCalledWith(
          "projects/TEST/repos/my-repo/branches",
          {
            json: {
              name: "refs/heads/feature/new",
              startPoint: "main",
            },
          },
        );
      });

      test("uses default project when not provided", async () => {
        mockJson(h.mockClients.branchUtils.post, {});

        await callAndParse(h.client, "manage_branches", {
          action: "create",
          repository: "my-repo",
          branch: "feature/new",
        });

        expect(h.mockClients.branchUtils.post).toHaveBeenCalledWith(
          "projects/DEFAULT/repos/my-repo/branches",
          expect.anything(),
        );
      });

      test("omits startPoint from body when not provided", async () => {
        mockJson(h.mockClients.branchUtils.post, {});

        await callAndParse(h.client, "manage_branches", {
          action: "create",
          project: "TEST",
          repository: "my-repo",
          branch: "feature/new",
        });

        expect(h.mockClients.branchUtils.post).toHaveBeenCalledWith(
          "projects/TEST/repos/my-repo/branches",
          {
            json: {
              name: "refs/heads/feature/new",
              startPoint: undefined,
            },
          },
        );
      });

      test("returns error when branchUtils.post rejects", async () => {
        h.mockClients.branchUtils.post.mockRejectedValueOnce(
          new Error("Invalid branch name"),
        );

        const result = await callRaw(h.client, "manage_branches", {
          action: "create",
          project: "TEST",
          repository: "my-repo",
          branch: "invalid/name",
        });

        expect(result.isError).toBe(true);
      });
    });

    describe("delete", () => {
      test("deletes a non-default branch", async () => {
        mockJson(h.mockClients.api.get, {
          displayId: "main",
          id: "refs/heads/main",
        });
        mockJson(h.mockClients.branchUtils.post, {});

        const parsed = await callAndParse<{
          deleted: boolean;
          branch: string;
        }>(h.client, "manage_branches", {
          action: "delete",
          project: "TEST",
          repository: "my-repo",
          branch: "feature/old",
        });

        expect(parsed.deleted).toBe(true);
        expect(parsed.branch).toBe("feature/old");

        expect(h.mockClients.branchUtils.post).toHaveBeenCalledWith(
          "projects/TEST/repos/my-repo/branches",
          { json: { name: "refs/heads/feature/old", dryRun: false } },
        );
      });

      test("refuses to delete the default branch", async () => {
        mockJson(h.mockClients.api.get, {
          displayId: "main",
          id: "refs/heads/main",
        });

        const result = await callRaw(h.client, "manage_branches", {
          action: "delete",
          project: "TEST",
          repository: "my-repo",
          branch: "main",
        });

        const content = result.content as Array<{ type: string; text: string }>;
        expect(content[0].text).toContain("Cannot delete the default branch");
        expect(result.isError).toBe(true);

        expect(h.mockClients.branchUtils.post).not.toHaveBeenCalled();
      });

      test("returns error when branchUtils.post fails after default-branch check", async () => {
        mockJson(h.mockClients.api.get, {
          displayId: "main",
          id: "refs/heads/main",
        });
        h.mockClients.branchUtils.post.mockRejectedValueOnce(
          new Error("Internal server error"),
        );

        const result = await callRaw(h.client, "manage_branches", {
          action: "delete",
          project: "TEST",
          repository: "my-repo",
          branch: "feature/old",
        });

        expect(result.isError).toBe(true);
      });

      test("uses default project when not provided", async () => {
        mockJson(h.mockClients.api.get, {
          displayId: "main",
          id: "refs/heads/main",
        });
        mockJson(h.mockClients.branchUtils.post, {});

        await callRaw(h.client, "manage_branches", {
          action: "delete",
          repository: "my-repo",
          branch: "feature/old",
        });

        expectCalledWith(
          h.mockClients.api.get,
          "projects/DEFAULT/repos/my-repo/default-branch",
        );
      });

      test("returns error when default-branch fetch fails", async () => {
        h.mockClients.api.get.mockRejectedValueOnce(new Error("Not found"));

        const result = await callRaw(h.client, "manage_branches", {
          action: "delete",
          project: "TEST",
          repository: "my-repo",
          branch: "feature/old",
        });

        expect(result.isError).toBe(true);
      });
    });
  });

  describe("list_branches (filterText + pagination params forwarding)", () => {
    const searchParamsOfBranchesCall = () => {
      const callArgs = h.mockClients.api.get.mock.calls.find((c) =>
        String(c[0]).endsWith("/branches"),
      );
      expect(
        callArgs,
        "expected a /branches request to have been made",
      ).toBeDefined();
      return (callArgs![1] as { searchParams: Record<string, unknown> })
        .searchParams;
    };

    test.each([
      { filterText: "feature", limit: 10, start: 0 },
      { filterText: "fix", limit: 25, start: 50 },
    ])(
      "passes filterText=$filterText, limit=$limit, start=$start",
      async ({ filterText, limit, start }) => {
        mockJson(h.mockClients.api.get, { values: [], isLastPage: true });

        await h.client.callTool({
          name: "list_branches",
          arguments: { repository: "r", filterText, limit, start },
        });

        const searchParams = searchParamsOfBranchesCall();
        expect(searchParams.limit).toBe(limit);
        expect(searchParams.start).toBe(start);
        expect(searchParams.filterText).toBe(filterText);
      },
    );

    test("omits filterText from searchParams when not provided", async () => {
      mockJson(h.mockClients.api.get, { values: [], isLastPage: true });

      await h.client.callTool({
        name: "list_branches",
        arguments: { repository: "r", limit: 1000, start: 0 },
      });

      const searchParams = searchParamsOfBranchesCall();
      expect(searchParams.limit).toBe(1000);
      expect(searchParams.start).toBe(0);
      expect(searchParams).not.toHaveProperty("filterText");
    });
  });

  describe("list_commits author filter (equivalence: case + partial match)", () => {
    const commitWithAuthor = (name: string, displayName?: string) => ({
      id: `sha${name}`,
      displayId: name,
      message: "c",
      authorTimestamp: 1,
      author: { name, displayName, emailAddress: `${name}@x.com` },
    });

    test.each<{ filter: string; expected: string[] }>([
      { filter: "alice", expected: ["alice"] },
      { filter: "ALICE", expected: ["alice"] }, // case-insensitive
      { filter: "Ali", expected: ["alice"] }, // partial match
      { filter: "Bob", expected: ["bob"] },
      { filter: "xyz", expected: [] }, // no match
    ])("filter '$filter' returns $expected", async ({ filter, expected }) => {
      mockJson(h.mockClients.api.get, {
        values: [
          commitWithAuthor("alice"),
          commitWithAuthor("bob"),
          commitWithAuthor("charlie"),
        ],
        isLastPage: true,
      });

      const parsed = await callAndParse<{
        commits: Array<{ author: { name: string } }>;
      }>(h.client, "list_commits", {
        repository: "r",
        author: filter,
        fields: "author.name",
      });
      const names = parsed.commits.map((c) => c.author.name);
      expect(names).toEqual(expected);
    });

    test("matches on displayName too", async () => {
      mockJson(h.mockClients.api.get, {
        values: [commitWithAuthor("user1", "Alice Smith")],
        isLastPage: true,
      });

      const parsed = await callAndParse<{ commits: unknown[] }>(
        h.client,
        "list_commits",
        { repository: "r", author: "smith" },
      );
      expect(parsed.commits).toHaveLength(1);
    });

    test("matches on slug field", async () => {
      mockJson(h.mockClients.api.get, {
        values: [
          {
            id: "sha1",
            author: { name: "user", slug: "dev-user", displayName: "Dev" },
          },
        ],
        isLastPage: true,
      });

      const parsed = await callAndParse<{ commits: unknown[] }>(
        h.client,
        "list_commits",
        { repository: "r", author: "dev-user" },
      );
      expect(parsed.commits).toHaveLength(1);
    });

    test("excludes commits without author", async () => {
      mockJson(h.mockClients.api.get, {
        values: [
          { id: "sha1", author: { name: "alice" } },
          { id: "sha2" },
          { id: "sha3", author: null },
        ],
        isLastPage: true,
      });

      const parsed = await callAndParse<{ commits: unknown[] }>(
        h.client,
        "list_commits",
        { repository: "r", author: "alice" },
      );
      expect(parsed.commits).toHaveLength(1);
    });
  });

  describe("get_commit", () => {
    test("returns a commit by ID", async () => {
      const commit = {
        id: "abc123",
        displayId: "abc123",
        message: "Fix bug",
        author: { name: "john", emailAddress: "john@example.com" },
        authorTimestamp: 1700000000000,
        committer: { name: "john", emailAddress: "john@example.com" },
        committerTimestamp: 1700000000000,
        parents: [{ id: "def456" }],
      };

      mockJson(h.mockClients.api.get, commit);

      const parsed = await callAndParse<{
        id: string;
        message: string;
        author: { name: string };
      }>(h.client, "get_commit", {
        project: "TEST",
        repository: "my-repo",
        commitId: "abc123",
      });

      expect(parsed.id).toBe("abc123");
      expect(parsed.message).toBe("Fix bug");
      expect(parsed.author.name).toBe("john");
    });

    test("uses default project when not provided", async () => {
      mockJson(h.mockClients.api.get, { id: "abc123" });

      await callAndParse(h.client, "get_commit", {
        repository: "my-repo",
        commitId: "abc123",
      });

      expect(h.mockClients.api.get).toHaveBeenCalledWith(
        "projects/DEFAULT/repos/my-repo/commits/abc123",
      );
    });

    test("returns raw output when fields is '*all'", async () => {
      const commit = { id: "abc123", displayId: "abc123", extra: "kept" };
      mockJson(h.mockClients.api.get, commit);

      const parsed = await callAndParse<{ extra: string }>(
        h.client,
        "get_commit",
        {
          project: "TEST",
          repository: "my-repo",
          commitId: "abc123",
          fields: "*all",
        },
      );

      expect(parsed.extra).toBe("kept");
    });

    test("returns custom fields subset when fields is provided", async () => {
      const commit = {
        id: "abc123",
        displayId: "abc123",
        message: "Fix bug",
        author: { name: "john", emailAddress: "john@example.com" },
      };
      mockJson(h.mockClients.api.get, commit);

      const parsed = await callAndParse<{ id: string; message: string }>(
        h.client,
        "get_commit",
        {
          project: "TEST",
          repository: "my-repo",
          commitId: "abc123",
          fields: "id,message",
        },
      );

      expect(parsed.id).toBe("abc123");
      expect(parsed.message).toBe("Fix bug");
      expect(parsed).not.toHaveProperty("author");
    });

    test("returns error when API call fails", async () => {
      h.mockClients.api.get.mockRejectedValueOnce(
        new Error("Commit not found"),
      );

      const result = await callRaw(h.client, "get_commit", {
        project: "TEST",
        repository: "my-repo",
        commitId: "nonexistent",
      });

      expect(result.isError).toBe(true);
    });
  });

  describe("compare_refs", () => {
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
      h.mockClients.api.get.mockRejectedValueOnce(
        new Error("Comparison failed"),
      );

      const result = await callRaw(h.client, "compare_refs", {
        project: "TEST",
        repository: "my-repo",
        from: "main",
        to: "nonexistent",
      });

      expect(result.isError).toBe(true);
    });
  });

  describe("list_tags", () => {
    test("returns tags from the API", async () => {
      mockJson(h.mockClients.api.get, {
        values: [
          { id: "refs/tags/v1.0.0", displayId: "v1.0.0", type: "TAG" },
          { id: "refs/tags/v2.0.0", displayId: "v2.0.0", type: "TAG" },
        ],
        size: 2,
        isLastPage: true,
      });

      const parsed = await callAndParse<{
        total: number;
        tags: Array<{ displayId: string }>;
      }>(h.client, "list_tags", {
        project: "TEST",
        repository: "my-repo",
      });

      expect(parsed.total).toBe(2);
      expect(parsed.tags).toHaveLength(2);
      expect(parsed.tags[0].displayId).toBe("v1.0.0");
    });

    test("passes filterText as search param", async () => {
      mockJson(h.mockClients.api.get, {
        values: [],
        size: 0,
        isLastPage: true,
      });

      await callAndParse(h.client, "list_tags", {
        project: "TEST",
        repository: "my-repo",
        filterText: "v1",
      });

      expectCalledWithSearchParams(
        h.mockClients.api.get,
        "projects/TEST/repos/my-repo/tags",
        { filterText: "v1", limit: 25, start: 0 },
      );
    });

    test("omits filterText from searchParams when not provided", async () => {
      mockJson(h.mockClients.api.get, {
        values: [],
        size: 0,
        isLastPage: true,
      });

      await callAndParse(h.client, "list_tags", { repository: "my-repo" });

      const callArgs = h.mockClients.api.get.mock.calls.find((c) =>
        String(c[0]).endsWith("/tags"),
      );
      const searchParams = (
        callArgs![1] as { searchParams: Record<string, unknown> }
      ).searchParams;
      expect(searchParams).not.toHaveProperty("filterText");
    });

    test("uses default project when not provided", async () => {
      mockJson(h.mockClients.api.get, {
        values: [],
        size: 0,
        isLastPage: true,
      });

      await callAndParse(h.client, "list_tags", { repository: "my-repo" });

      expect(h.mockClients.api.get).toHaveBeenCalledWith(
        "projects/DEFAULT/repos/my-repo/tags",
        expect.anything(),
      );
    });

    test("returns raw output when fields is '*all'", async () => {
      mockJson(h.mockClients.api.get, {
        values: [{ id: "refs/tags/v1.0.0", extra: "kept" }],
        size: 1,
        isLastPage: true,
      });

      const parsed = await callAndParse<{
        tags: Array<{ extra: string }>;
      }>(h.client, "list_tags", {
        project: "TEST",
        repository: "my-repo",
        fields: "*all",
      });

      expect(parsed.tags[0].extra).toBe("kept");
    });

    test("returns custom fields subset when fields is provided", async () => {
      mockJson(h.mockClients.api.get, {
        values: [
          { id: "refs/tags/v1.0.0", displayId: "v1.0.0", hash: "abc123" },
        ],
        size: 1,
        isLastPage: true,
      });

      const parsed = await callAndParse<{
        tags: Array<{ id: string; displayId: string }>;
      }>(h.client, "list_tags", {
        project: "TEST",
        repository: "my-repo",
        fields: "id,displayId",
      });

      expect(parsed.tags[0].id).toBe("refs/tags/v1.0.0");
      expect(parsed.tags[0].displayId).toBe("v1.0.0");
      expect(parsed.tags[0]).not.toHaveProperty("hash");
    });

    test("returns error when API call fails", async () => {
      h.mockClients.api.get.mockRejectedValueOnce(new Error("Not found"));

      const result = await callRaw(h.client, "list_tags", {
        project: "TEST",
        repository: "my-repo",
      });

      expect(result.isError).toBe(true);
    });
  });

  describe("create_tag", () => {
    test("creates a tag with required params", async () => {
      mockJson(h.mockClients.api.post, {
        id: "refs/tags/v1.0.0",
        displayId: "v1.0.0",
        hash: "abc123",
      });

      const parsed = await callAndParse<{
        id: string;
        displayId: string;
      }>(h.client, "create_tag", {
        project: "TEST",
        repository: "my-repo",
        name: "v1.0.0",
        startPoint: "abc123",
      });

      expect(parsed.id).toBe("refs/tags/v1.0.0");
      expect(parsed.displayId).toBe("v1.0.0");

      expect(h.mockClients.api.post).toHaveBeenCalledWith(
        "projects/TEST/repos/my-repo/tags",
        {
          json: {
            name: "refs/tags/v1.0.0",
            startPoint: "abc123",
            message: undefined,
          },
        },
      );
    });

    test("includes message in body when provided", async () => {
      mockJson(h.mockClients.api.post, { id: "refs/tags/v1.0.0" });

      await callAndParse(h.client, "create_tag", {
        project: "TEST",
        repository: "my-repo",
        name: "v1.0.0",
        startPoint: "abc123",
        message: "Release v1.0.0",
      });

      expect(h.mockClients.api.post).toHaveBeenCalledWith(
        "projects/TEST/repos/my-repo/tags",
        {
          json: {
            name: "refs/tags/v1.0.0",
            startPoint: "abc123",
            message: "Release v1.0.0",
          },
        },
      );
    });

    test("uses default project when not provided", async () => {
      mockJson(h.mockClients.api.post, { id: "refs/tags/v1.0.0" });

      await callAndParse(h.client, "create_tag", {
        repository: "my-repo",
        name: "v1.0.0",
        startPoint: "abc123",
      });

      expect(h.mockClients.api.post).toHaveBeenCalledWith(
        "projects/DEFAULT/repos/my-repo/tags",
        expect.anything(),
      );
    });

    test("returns error when API call fails", async () => {
      h.mockClients.api.post.mockRejectedValueOnce(
        new Error("Tag already exists"),
      );

      const result = await callRaw(h.client, "create_tag", {
        project: "TEST",
        repository: "my-repo",
        name: "v1.0.0",
        startPoint: "abc123",
      });

      expect(result.isError).toBe(true);
    });
  });

  describe("get_tag", () => {
    test("retrieves a tag by name", async () => {
      mockJson(h.mockClients.api.get, {
        id: "refs/tags/v1.0.0",
        displayId: "v1.0.0",
        hash: "abc123",
      });

      const parsed = await callAndParse<{
        id: string;
        displayId: string;
        hash: string;
      }>(h.client, "get_tag", {
        project: "TEST",
        repository: "my-repo",
        name: "v1.0.0",
      });

      expect(parsed.id).toBe("refs/tags/v1.0.0");
      expect(parsed.displayId).toBe("v1.0.0");
      expect(parsed.hash).toBe("abc123");
      expect(h.mockClients.api.get).toHaveBeenCalledWith(
        "projects/TEST/repos/my-repo/tags/v1.0.0",
      );
    });

    test("uses default project when not provided", async () => {
      mockJson(h.mockClients.api.get, { id: "refs/tags/v1.0.0" });

      await callAndParse(h.client, "get_tag", {
        repository: "my-repo",
        name: "v1.0.0",
      });

      expect(h.mockClients.api.get).toHaveBeenCalledWith(
        "projects/DEFAULT/repos/my-repo/tags/v1.0.0",
      );
    });

    test('returns raw response when fields is "*all"', async () => {
      const raw = { id: "refs/tags/v1.0.0", hash: "abc123", extra: 42 };
      mockJson(h.mockClients.api.get, raw);

      const parsed = await callAndParse<Record<string, unknown>>(
        h.client,
        "get_tag",
        {
          project: "TEST",
          repository: "my-repo",
          name: "v1.0.0",
          fields: "*all",
        },
      );

      expect(parsed.extra).toBe(42);
    });

    test("returns only requested custom fields", async () => {
      mockJson(h.mockClients.api.get, {
        id: "refs/tags/v1.0.0",
        displayId: "v1.0.0",
        hash: "abc123",
        latestCommit: "def456",
      });

      const parsed = await callAndParse<{ id: string; hash?: string }>(
        h.client,
        "get_tag",
        {
          project: "TEST",
          repository: "my-repo",
          name: "v1.0.0",
          fields: "id,displayId",
        },
      );

      expect(parsed.id).toBe("refs/tags/v1.0.0");
      expect(parsed.hash).toBeUndefined();
    });

    test("returns error when API call fails", async () => {
      h.mockClients.api.get.mockRejectedValueOnce(new Error("Tag not found"));

      const result = await callRaw(h.client, "get_tag", {
        project: "TEST",
        repository: "my-repo",
        name: "nonexistent",
      });

      expect(result.isError).toBe(true);
    });
  });

  describe("delete_tag", () => {
    test("deletes a tag by name", async () => {
      mockVoid(h.mockClients.git.delete);

      const parsed = await callAndParse<{ deleted: boolean; tag: string }>(
        h.client,
        "delete_tag",
        {
          project: "TEST",
          repository: "my-repo",
          name: "v1.0.0",
        },
      );

      expect(parsed.deleted).toBe(true);
      expect(parsed.tag).toBe("v1.0.0");
      expect(h.mockClients.git.delete).toHaveBeenCalledWith(
        "projects/TEST/repos/my-repo/tags/v1.0.0",
      );
    });

    test("uses default project when not provided", async () => {
      mockVoid(h.mockClients.git.delete);

      await callAndParse(h.client, "delete_tag", {
        repository: "my-repo",
        name: "v1.0.0",
      });

      expect(h.mockClients.git.delete).toHaveBeenCalledWith(
        "projects/DEFAULT/repos/my-repo/tags/v1.0.0",
      );
    });

    test("returns error when API call fails", async () => {
      h.mockClients.git.delete.mockRejectedValueOnce(
        new Error("Tag not found"),
      );

      const result = await callRaw(h.client, "delete_tag", {
        project: "TEST",
        repository: "my-repo",
        name: "nonexistent",
      });

      expect(result.isError).toBe(true);
    });
  });
});
