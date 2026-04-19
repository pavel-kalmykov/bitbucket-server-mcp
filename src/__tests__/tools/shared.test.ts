import { describe, test, expect } from "vitest";
import { createTestToolContext } from "../tool-test-utils.js";
import { mockJson, createMockClients } from "../test-utils.js";
import { mergeDefaultReviewers } from "../../tools/shared.js";

function defaultParams(
  overrides: Partial<Parameters<typeof mergeDefaultReviewers>[0]> = {},
) {
  return {
    clients: createMockClients(),
    resolvedProject: "PROJ",
    repository: "repo",
    srcProject: "PROJ",
    srcRepo: "repo",
    sourceBranch: "feature",
    targetBranch: "main",
    existingReviewers: [],
    ...overrides,
  };
}

describe("ToolContext", () => {
  describe("constructor defaults", () => {
    test("maxLinesPerFile defaults to 500 when not provided", () => {
      const ctx = createTestToolContext();
      expect(ctx.maxLinesPerFile).toBe(500);
    });

    test("maxLinesPerFile takes explicit value", () => {
      const ctx = createTestToolContext({ maxLinesPerFile: 1000 });
      expect(ctx.maxLinesPerFile).toBe(1000);
    });

    test("maxLinesPerFile=0 is respected (disables truncation)", () => {
      const ctx = createTestToolContext({ maxLinesPerFile: 0 });
      expect(ctx.maxLinesPerFile).toBe(0);
    });

    test("defaultProject defaults to undefined", () => {
      const ctx = createTestToolContext();
      expect(ctx.defaultProject).toBeUndefined();
    });

    test("defaultProject takes explicit value", () => {
      const ctx = createTestToolContext({ defaultProject: "PROJ" });
      expect(ctx.defaultProject).toBe("PROJ");
    });
  });

  describe("resolveProject (decision table: provided x defaultProject)", () => {
    test.each<{
      name: string;
      provided: string | undefined;
      defaultProject: string | undefined;
      expected: string;
    }>([
      {
        name: "provided + defaultProject: provided wins",
        provided: "EXPLICIT",
        defaultProject: "DEFAULT",
        expected: "EXPLICIT",
      },
      {
        name: "provided only",
        provided: "EXPLICIT",
        defaultProject: undefined,
        expected: "EXPLICIT",
      },
      {
        name: "defaultProject only",
        provided: undefined,
        defaultProject: "DEFAULT",
        expected: "DEFAULT",
      },
      {
        name: "empty string provided + defaultProject: defaultProject wins",
        provided: "",
        defaultProject: "DEFAULT",
        expected: "DEFAULT",
      },
    ])("resolves: $name", ({ provided, defaultProject, expected }) => {
      const ctx = createTestToolContext({ defaultProject });
      expect(ctx.resolveProject(provided)).toBe(expected);
    });

    test.each<{
      name: string;
      provided: string | undefined;
      defaultProject: string | undefined;
    }>([
      {
        name: "neither provided nor defaultProject",
        provided: undefined,
        defaultProject: undefined,
      },
      {
        name: "empty string provided + no default",
        provided: "",
        defaultProject: undefined,
      },
    ])("throws: $name", ({ provided, defaultProject }) => {
      const ctx = createTestToolContext({ defaultProject });
      expect(() => ctx.resolveProject(provided)).toThrow(/Project is required/);
    });
  });

  describe("resolveProject error message", () => {
    test("mentions BITBUCKET_DEFAULT_PROJECT env var", () => {
      const ctx = createTestToolContext();
      expect(() => ctx.resolveProject()).toThrow(/BITBUCKET_DEFAULT_PROJECT/);
    });
  });
});

describe("mergeDefaultReviewers (decision table)", () => {
  describe("same source and target repo", () => {
    test("skips target repo lookup when srcProject=resolvedProject and srcRepo=repository", async () => {
      const clients = createMockClients();
      mockJson(clients.api.get, { id: 42 });
      mockJson(clients.defaultReviewers.get, [{ name: "alice" }]);

      const result = await mergeDefaultReviewers(
        defaultParams({
          clients,
          resolvedProject: "P",
          repository: "r",
          srcProject: "P",
          srcRepo: "r",
          existingReviewers: [],
        }),
      );

      expect(result).toEqual([{ user: { name: "alice" } }]);
      expect(clients.api.get).toHaveBeenCalledTimes(1);
      expect(clients.api.get).toHaveBeenCalledWith("projects/P/repos/r");
    });

    test("fetches source repo by correct URL", async () => {
      const clients = createMockClients();
      mockJson(clients.api.get, { id: 42 });
      mockJson(clients.defaultReviewers.get, []);

      await mergeDefaultReviewers(
        defaultParams({
          clients,
          srcProject: "SRC",
          srcRepo: "src-repo",
          resolvedProject: "SRC",
          repository: "src-repo",
        }),
      );

      expect(clients.api.get).toHaveBeenCalledWith(
        "projects/SRC/repos/src-repo",
      );
    });

    test("passes correct searchParams to defaultReviewers endpoint", async () => {
      const clients = createMockClients();
      mockJson(clients.api.get, { id: 42 });
      mockJson(clients.defaultReviewers.get, []);

      await mergeDefaultReviewers(
        defaultParams({
          clients,
          resolvedProject: "P",
          repository: "r",
          srcProject: "P",
          srcRepo: "r",
          sourceBranch: "feature",
          targetBranch: "main",
        }),
      );

      expect(clients.defaultReviewers.get).toHaveBeenCalledWith(
        "projects/P/repos/r/reviewers",
        expect.objectContaining({
          searchParams: expect.objectContaining({
            sourceRepoId: 42,
            targetRepoId: 42,
            sourceRefId: "refs/heads/feature",
            targetRefId: "refs/heads/main",
          }),
        }),
      );
    });

    test("deduplicates default reviewers against existing", async () => {
      const clients = createMockClients();
      mockJson(clients.api.get, { id: 1 });
      mockJson(clients.defaultReviewers.get, [
        { name: "alice" },
        { name: "bob" },
      ]);

      const result = await mergeDefaultReviewers(
        defaultParams({
          clients,
          existingReviewers: [{ user: { name: "alice" } }],
        }),
      );

      const names = result.map((r) => r.user.name);
      expect(names).toEqual(["alice", "bob"]);
      expect(names).toHaveLength(2);
    });
  });

  describe("cross-repo (source != target)", () => {
    test("fetches both source and target repo IDs", async () => {
      const clients = createMockClients();
      clients.api.get
        .mockReturnValueOnce({
          json: () => Promise.resolve({ id: 10 }),
        } as never)
        .mockReturnValueOnce({
          json: () => Promise.resolve({ id: 20 }),
        } as never);
      mockJson(clients.defaultReviewers.get, []);

      await mergeDefaultReviewers(
        defaultParams({
          clients,
          srcProject: "SRC",
          srcRepo: "src-repo",
          resolvedProject: "TGT",
          repository: "tgt-repo",
        }),
      );

      expect(clients.api.get).toHaveBeenCalledTimes(2);
      expect(clients.api.get).toHaveBeenCalledWith(
        "projects/SRC/repos/src-repo",
      );
      expect(clients.api.get).toHaveBeenCalledWith(
        "projects/TGT/repos/tgt-repo",
      );
    });

    test("uses different source and target repo IDs in searchParams", async () => {
      const clients = createMockClients();
      clients.api.get
        .mockReturnValueOnce({
          json: () => Promise.resolve({ id: 10 }),
        } as never)
        .mockReturnValueOnce({
          json: () => Promise.resolve({ id: 20 }),
        } as never);
      mockJson(clients.defaultReviewers.get, []);

      await mergeDefaultReviewers(
        defaultParams({
          clients,
          srcProject: "SRC",
          srcRepo: "src-repo",
          resolvedProject: "TGT",
          repository: "tgt-repo",
          sourceBranch: "feat",
          targetBranch: "develop",
        }),
      );

      expect(clients.defaultReviewers.get).toHaveBeenCalledWith(
        "projects/TGT/repos/tgt-repo/reviewers",
        expect.objectContaining({
          searchParams: expect.objectContaining({
            sourceRepoId: 10,
            targetRepoId: 20,
            sourceRefId: "refs/heads/feat",
            targetRefId: "refs/heads/develop",
          }),
        }),
      );
    });

    test("cross-repo only differs in project: still fetches both", async () => {
      const clients = createMockClients();
      clients.api.get
        .mockReturnValueOnce({
          json: () => Promise.resolve({ id: 1 }),
        } as never)
        .mockReturnValueOnce({
          json: () => Promise.resolve({ id: 2 }),
        } as never);
      mockJson(clients.defaultReviewers.get, []);

      await mergeDefaultReviewers(
        defaultParams({
          clients,
          srcProject: "OTHER",
          srcRepo: "repo",
          resolvedProject: "PROJ",
          repository: "repo",
        }),
      );

      expect(clients.api.get).toHaveBeenCalledTimes(2);
    });
  });

  describe("error handling", () => {
    test("returns existing reviewers when API call fails", async () => {
      const clients = createMockClients();
      clients.api.get.mockImplementation(() => {
        throw new Error("Network error");
      });

      const result = await mergeDefaultReviewers(
        defaultParams({
          clients,
          existingReviewers: [{ user: { name: "existing" } }],
        }),
      );

      expect(result).toEqual([{ user: { name: "existing" } }]);
    });

    test("returns existing reviewers when defaultReviewers call fails", async () => {
      const clients = createMockClients();
      mockJson(clients.api.get, { id: 1 });
      clients.defaultReviewers.get.mockImplementation(() => {
        throw new Error("Forbidden");
      });

      const result = await mergeDefaultReviewers(
        defaultParams({
          clients,
          existingReviewers: [{ user: { name: "existing" } }],
        }),
      );

      expect(result).toEqual([{ user: { name: "existing" } }]);
    });
  });

  describe("non-array default reviewers response", () => {
    test("ignores default reviewers when response is not an array", async () => {
      const clients = createMockClients();
      mockJson(clients.api.get, { id: 1 });
      mockJson(clients.defaultReviewers.get, "not-an-array");

      const result = await mergeDefaultReviewers(
        defaultParams({
          clients,
          existingReviewers: [{ user: { name: "bob" } }],
        }),
      );

      expect(result).toEqual([{ user: { name: "bob" } }]);
    });
  });
});
