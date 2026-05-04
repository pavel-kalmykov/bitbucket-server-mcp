import { describe, test, expect } from "vitest";
import { registerPullRequestTools } from "../../tools/pull-requests.js";
import { mockJson } from "../test-utils.js";
import {
  callAndParse,
  expectCalledWithJson,
  setupToolHarness,
} from "../tool-test-utils.js";

describe("Pull request tools", () => {
  const h = setupToolHarness({
    register: registerPullRequestTools,
    defaultProject: "DEFAULT",
    maxLinesPerFile: 5,
  });
  describe("create_pull_request", () => {
    test("should create a basic pull request", async () => {
      const mockPr = { id: 1, title: "My PR", state: "OPEN" };

      // Mock repo lookup for default reviewers (source repo)
      mockJson(h.mockClients.api.get, { id: 10 });
      // Mock default reviewers fetch
      mockJson(h.mockClients.defaultReviewers.get, []);
      // Mock PR creation
      mockJson(h.mockClients.api.post, mockPr);

      const parsed = await callAndParse<{ id: number; title: string }>(
        h.client,
        "create_pull_request",
        {
          project: "PROJ",
          repository: "my-repo",
          title: "My PR",
          sourceBranch: "feature/x",
          targetBranch: "main",
          reviewers: ["alice"],
        },
      );
      expect(parsed.id).toBe(1);
      expect(parsed.title).toBe("My PR");

      // Verify the POST body
      expectCalledWithJson(
        h.mockClients.api.post,
        "projects/PROJ/repos/my-repo/pull-requests",
        {
          title: "My PR",
          fromRef: expect.objectContaining({
            id: "refs/heads/feature/x",
            repository: { slug: "my-repo", project: { key: "PROJ" } },
          }),
          toRef: expect.objectContaining({
            id: "refs/heads/main",
            repository: { slug: "my-repo", project: { key: "PROJ" } },
          }),
          reviewers: [{ user: { name: "alice" } }],
        },
      );
    });

    test("should create a cross-repo pull request with sourceProject/sourceRepository", async () => {
      const mockPr = { id: 2, title: "Cross-repo PR", state: "OPEN" };

      // Mock source repo lookup
      mockJson(h.mockClients.api.get, { id: 20 });
      // Mock target repo lookup (different repo, so both are fetched)
      mockJson(h.mockClients.api.get, { id: 30 });
      // Mock default reviewers fetch
      mockJson(h.mockClients.defaultReviewers.get, [{ name: "bob" }]);
      // Mock PR creation
      mockJson(h.mockClients.api.post, mockPr);

      const parsed = await callAndParse<{ id: number }>(
        h.client,
        "create_pull_request",
        {
          project: "TARGET",
          repository: "target-repo",
          title: "Cross-repo PR",
          sourceBranch: "feature/y",
          targetBranch: "develop",
          sourceProject: "SOURCE",
          sourceRepository: "source-repo",
          reviewers: ["alice"],
        },
      );
      expect(parsed.id).toBe(2);

      // Verify fromRef uses source project/repo
      expectCalledWithJson(
        h.mockClients.api.post,
        "projects/TARGET/repos/target-repo/pull-requests",
        {
          fromRef: expect.objectContaining({
            repository: { slug: "source-repo", project: { key: "SOURCE" } },
          }),
          toRef: expect.objectContaining({
            repository: { slug: "target-repo", project: { key: "TARGET" } },
          }),
          // alice + default reviewer bob
          reviewers: [{ user: { name: "alice" } }, { user: { name: "bob" } }],
        },
      );
    });

    test("should deduplicate default reviewers with explicit reviewers", async () => {
      const mockPr = { id: 3, title: "Dedup PR", state: "OPEN" };

      mockJson(h.mockClients.api.get, { id: 10 });
      mockJson(h.mockClients.defaultReviewers.get, [
        { name: "alice" },
        { name: "carol" },
      ]);
      mockJson(h.mockClients.api.post, mockPr);

      await callAndParse(h.client, "create_pull_request", {
        project: "PROJ",
        repository: "my-repo",
        title: "Dedup PR",
        sourceBranch: "feature/z",
        targetBranch: "main",
        reviewers: ["alice"],
      });

      // alice should appear once, carol added from defaults
      expectCalledWithJson(h.mockClients.api.post, expect.any(String), {
        reviewers: [{ user: { name: "alice" } }, { user: { name: "carol" } }],
      });
    });

    test("should skip default reviewers when includeDefaultReviewers is false", async () => {
      const mockPr = { id: 4, title: "No defaults", state: "OPEN" };

      mockJson(h.mockClients.api.post, mockPr);

      await callAndParse(h.client, "create_pull_request", {
        project: "PROJ",
        repository: "my-repo",
        title: "No defaults",
        sourceBranch: "feature/a",
        targetBranch: "main",
        includeDefaultReviewers: false,
      });

      expect(h.mockClients.api.get).not.toHaveBeenCalled();
      expect(h.mockClients.defaultReviewers.get).not.toHaveBeenCalled();
    });

    test("should include description in body when provided", async () => {
      mockJson(h.mockClients.api.post, { id: 5, state: "OPEN" });

      await callAndParse(h.client, "create_pull_request", {
        project: "PROJ",
        repository: "my-repo",
        title: "With desc",
        description: "PR description",
        sourceBranch: "feature/x",
        targetBranch: "main",
        includeDefaultReviewers: false,
      });

      expectCalledWithJson(
        h.mockClients.api.post,
        "projects/PROJ/repos/my-repo/pull-requests",
        { description: "PR description" },
      );
    });

    test("should send empty reviewers array when none provided", async () => {
      mockJson(h.mockClients.api.post, { id: 6, state: "OPEN" });

      await callAndParse(h.client, "create_pull_request", {
        project: "PROJ",
        repository: "my-repo",
        title: "No reviewers",
        sourceBranch: "feature/x",
        targetBranch: "main",
        includeDefaultReviewers: false,
      });

      expectCalledWithJson(
        h.mockClients.api.post,
        "projects/PROJ/repos/my-repo/pull-requests",
        { reviewers: [] },
      );
    });
  });
});
