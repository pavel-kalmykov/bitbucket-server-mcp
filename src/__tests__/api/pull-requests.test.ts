import { describe, test, expect } from "vitest";
import {
  mockJson,
  createMockClients,
  createTestClient,
} from "../test-utils.js";
import type { MockHttpClients } from "../test-utils.js";
import type { ApiContext } from "../../api/context.js";
import { mergeDefaultReviewers } from "../../api/pull-requests.js";

function testContext(http: MockHttpClients): ApiContext {
  return createTestClient({ http });
}

function defaultParams(
  overrides: Partial<Parameters<typeof mergeDefaultReviewers>[0]> = {},
) {
  return {
    ctx: testContext(createMockClients()),
    targetProject: "PROJ",
    repository: "repo",
    sourceProject: "PROJ",
    sourceRepository: "repo",
    sourceBranch: "feature",
    targetBranch: "main",
    existingReviewers: [],
    ...overrides,
  };
}

describe("mergeDefaultReviewers (decision table)", () => {
  describe("same source and target repo", () => {
    test("skips target repo lookup when srcProject=resolvedProject and srcRepo=repository", async () => {
      const http = createMockClients();
      const ctx = testContext(http);
      mockJson(http.api.get, { id: 42 });
      mockJson(http.defaultReviewers.get, [{ name: "alice" }]);

      const result = await mergeDefaultReviewers(
        defaultParams({
          ctx,
          targetProject: "P",
          repository: "r",
          sourceProject: "P",
          sourceRepository: "r",
          existingReviewers: [],
        }),
      );

      expect(result).toEqual([{ user: { name: "alice" } }]);
      expect(http.api.get).toHaveBeenCalledTimes(1);
      expect(http.api.get).toHaveBeenCalledWith("projects/P/repos/r");
    });

    test("fetches source repo by correct URL", async () => {
      const http = createMockClients();
      const ctx = testContext(http);
      mockJson(http.api.get, { id: 42 });
      mockJson(http.defaultReviewers.get, []);

      await mergeDefaultReviewers(
        defaultParams({
          ctx,
          sourceProject: "SRC",
          sourceRepository: "src-repo",
          targetProject: "SRC",
          repository: "src-repo",
        }),
      );

      expect(http.api.get).toHaveBeenCalledWith("projects/SRC/repos/src-repo");
    });

    test("passes correct searchParams to defaultReviewers endpoint", async () => {
      const http = createMockClients();
      const ctx = testContext(http);
      mockJson(http.api.get, { id: 42 });
      mockJson(http.defaultReviewers.get, []);

      await mergeDefaultReviewers(
        defaultParams({
          ctx,
          targetProject: "P",
          repository: "r",
          sourceProject: "P",
          sourceRepository: "r",
          sourceBranch: "feature",
          targetBranch: "main",
        }),
      );

      expect(http.defaultReviewers.get).toHaveBeenCalledWith(
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
      const http = createMockClients();
      const ctx = testContext(http);
      mockJson(http.api.get, { id: 1 });
      mockJson(http.defaultReviewers.get, [{ name: "alice" }, { name: "bob" }]);

      const result = await mergeDefaultReviewers(
        defaultParams({
          ctx,
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
      const http = createMockClients();
      const ctx = testContext(http);
      http.api.get
        .mockReturnValueOnce({
          json: () => Promise.resolve({ id: 10 }),
        } as never)
        .mockReturnValueOnce({
          json: () => Promise.resolve({ id: 20 }),
        } as never);
      mockJson(http.defaultReviewers.get, []);

      await mergeDefaultReviewers(
        defaultParams({
          ctx,
          sourceProject: "SRC",
          sourceRepository: "src-repo",
          targetProject: "TGT",
          repository: "tgt-repo",
        }),
      );

      expect(http.api.get).toHaveBeenCalledTimes(2);
      expect(http.api.get).toHaveBeenCalledWith("projects/SRC/repos/src-repo");
      expect(http.api.get).toHaveBeenCalledWith("projects/TGT/repos/tgt-repo");
    });

    test("uses different source and target repo IDs in searchParams", async () => {
      const http = createMockClients();
      const ctx = testContext(http);
      http.api.get
        .mockReturnValueOnce({
          json: () => Promise.resolve({ id: 10 }),
        } as never)
        .mockReturnValueOnce({
          json: () => Promise.resolve({ id: 20 }),
        } as never);
      mockJson(http.defaultReviewers.get, []);

      await mergeDefaultReviewers(
        defaultParams({
          ctx,
          sourceProject: "SRC",
          sourceRepository: "src-repo",
          targetProject: "TGT",
          repository: "tgt-repo",
          sourceBranch: "feat",
          targetBranch: "develop",
        }),
      );

      expect(http.defaultReviewers.get).toHaveBeenCalledWith(
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
      const http = createMockClients();
      const ctx = testContext(http);
      http.api.get
        .mockReturnValueOnce({
          json: () => Promise.resolve({ id: 1 }),
        } as never)
        .mockReturnValueOnce({
          json: () => Promise.resolve({ id: 2 }),
        } as never);
      mockJson(http.defaultReviewers.get, []);

      await mergeDefaultReviewers(
        defaultParams({
          ctx,
          sourceProject: "OTHER",
          sourceRepository: "repo",
          targetProject: "PROJ",
          repository: "repo",
        }),
      );

      expect(http.api.get).toHaveBeenCalledTimes(2);
    });
  });

  describe("error handling", () => {
    test("returns existing reviewers when API call fails", async () => {
      const http = createMockClients();
      const ctx = testContext(http);
      http.api.get.mockImplementation(() => {
        throw new Error("Network error");
      });

      const result = await mergeDefaultReviewers(
        defaultParams({
          ctx,
          existingReviewers: [{ user: { name: "existing" } }],
        }),
      );

      expect(result).toEqual([{ user: { name: "existing" } }]);
    });

    test("returns existing reviewers when defaultReviewers call fails", async () => {
      const http = createMockClients();
      const ctx = testContext(http);
      mockJson(http.api.get, { id: 1 });
      http.defaultReviewers.get.mockImplementation(() => {
        throw new Error("Forbidden");
      });

      const result = await mergeDefaultReviewers(
        defaultParams({
          ctx,
          existingReviewers: [{ user: { name: "existing" } }],
        }),
      );

      expect(result).toEqual([{ user: { name: "existing" } }]);
    });
  });

  describe("non-array default reviewers response", () => {
    test("ignores default reviewers when response is not an array", async () => {
      const http = createMockClients();
      const ctx = testContext(http);
      mockJson(http.api.get, { id: 1 });
      mockJson(http.defaultReviewers.get, "not-an-array");

      const result = await mergeDefaultReviewers(
        defaultParams({
          ctx,
          existingReviewers: [{ user: { name: "bob" } }],
        }),
      );

      expect(result).toEqual([{ user: { name: "bob" } }]);
    });
  });
});
