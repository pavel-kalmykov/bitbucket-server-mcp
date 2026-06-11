import { describe, test, expect } from "vitest";
import { registerPullRequestTools } from "../../tools/pull-requests.js";
import { mockJson, mockReject } from "../test-utils.js";
import {
  callAndParse,
  callRaw,
  expectCalledWithJson,
  expectCalledWithStrictJson,
  setupToolHarness,
} from "../tool-test-utils.js";

describe("Pull request tools", () => {
  const h = setupToolHarness({
    register: registerPullRequestTools,
    defaultProject: "DEFAULT",
    maxLinesPerFile: 5,
  });
  describe("update_pull_request", () => {
    test("should preserve reviewers when not provided", async () => {
      const existingPr = {
        id: 10,
        version: 5,
        title: "Old title",
        description: "Old desc",
        toRef: { id: "refs/heads/main", displayId: "main" },
        reviewers: [{ user: { name: "bob" }, status: "APPROVED" }],
      };
      const updatedPr = { ...existingPr, title: "New title" };

      // GET current PR
      mockJson(h.mockClients.api.get, existingPr);
      // PUT updated PR
      mockJson(h.mockClients.api.put, updatedPr);

      const parsed = await callAndParse<{ title: string }>(
        h.client,
        "update_pull_request",
        {
          project: "PROJ",
          repository: "my-repo",
          prId: 10,
          title: "New title",
        },
      );
      expect(parsed.title).toBe("New title");

      // Verify reviewers were preserved
      expectCalledWithJson(
        h.mockClients.api.put,
        "projects/PROJ/repos/my-repo/pull-requests/10",
        {
          title: "New title",
          reviewers: [{ user: { name: "bob" }, status: "APPROVED" }],
        },
      );
    });

    test("should replace reviewers when provided", async () => {
      const existingPr = {
        id: 10,
        version: 5,
        title: "Title",
        description: "Desc",
        toRef: { id: "refs/heads/main", displayId: "main" },
        reviewers: [{ user: { name: "bob" } }],
      };

      mockJson(h.mockClients.api.get, existingPr);
      mockJson(h.mockClients.api.put, {
        ...existingPr,
        reviewers: [{ user: { name: "carol" } }],
      });

      await callAndParse(h.client, "update_pull_request", {
        project: "PROJ",
        repository: "my-repo",
        prId: 10,
        reviewers: ["carol"],
      });

      expectCalledWithJson(h.mockClients.api.put, expect.any(String), {
        reviewers: [{ user: { name: "carol" } }],
      });
    });

    test("should update target branch preserving repository info for cross-repo PRs", async () => {
      const existingPr = {
        id: 10,
        version: 5,
        title: "Title",
        description: "Desc",
        toRef: {
          id: "refs/heads/main",
          displayId: "main",
          repository: { slug: "upstream-repo", project: { key: "UPSTREAM" } },
        },
        reviewers: [],
      };

      mockJson(h.mockClients.api.get, existingPr);
      mockJson(h.mockClients.api.put, {
        ...existingPr,
        toRef: { ...existingPr.toRef, id: "refs/heads/develop" },
      });

      await callAndParse(h.client, "update_pull_request", {
        project: "PROJ",
        repository: "my-repo",
        prId: 10,
        targetBranch: "develop",
      });

      expect(h.mockClients.api.get).toHaveBeenCalledWith(
        "projects/PROJ/repos/my-repo/pull-requests/10",
      );

      expectCalledWithJson(h.mockClients.api.put, expect.any(String), {
        toRef: {
          id: "refs/heads/develop",
          displayId: "main",
          repository: {
            slug: "upstream-repo",
            project: { key: "UPSTREAM" },
          },
        },
      });
    });

    test.each([
      { title: "Original", description: "Original desc", reviewer: "alice" },
      {
        title: "Current Title",
        description: "Current Desc",
        reviewer: "carol",
      },
    ])(
      "preserves title/description when only reviewers updated (title=$title)",
      async ({ title, description, reviewer }) => {
        const existingPr = {
          id: 10,
          version: 5,
          title,
          description,
          toRef: { id: "refs/heads/main", displayId: "main" },
          reviewers: [],
        };

        mockJson(h.mockClients.api.get, existingPr);
        mockJson(h.mockClients.api.put, existingPr);

        await callAndParse(h.client, "update_pull_request", {
          project: "PROJ",
          repository: "my-repo",
          prId: 10,
          reviewers: [reviewer],
        });

        expectCalledWithJson(h.mockClients.api.put, expect.any(String), {
          title,
          description,
          reviewers: [{ user: { name: reviewer } }],
        });
      },
    );

    test("should update description without changing title", async () => {
      const existingPr = {
        id: 11,
        version: 3,
        title: "Keep me",
        description: "Old desc",
        toRef: { id: "refs/heads/main", displayId: "main" },
        reviewers: [],
      };

      mockJson(h.mockClients.api.get, existingPr);
      mockJson(h.mockClients.api.put, existingPr);

      await callAndParse(h.client, "update_pull_request", {
        project: "PROJ",
        repository: "my-repo",
        prId: 11,
        description: "New desc",
      });

      expectCalledWithJson(h.mockClients.api.put, expect.any(String), {
        title: "Keep me",
        description: "New desc",
      });
    });

    test("should not send author field in PUT body", async () => {
      const existingPr = {
        id: 12,
        version: 2,
        title: "Old title",
        description: "Old desc",
        toRef: { id: "refs/heads/main", displayId: "main" },
        reviewers: [],
        author: { user: { name: "alice", slug: "alice" } },
      };

      mockJson(h.mockClients.api.get, existingPr);
      mockJson(h.mockClients.api.put, { ...existingPr, title: "New title" });

      await callAndParse(h.client, "update_pull_request", {
        project: "PROJ",
        repository: "my-repo",
        prId: 12,
        title: "New title",
      });

      expectCalledWithStrictJson(
        h.mockClients.api.put,
        "projects/PROJ/repos/my-repo/pull-requests/12",
        {
          id: 12,
          version: 2,
          title: "New title",
          description: "Old desc",
          toRef: { id: "refs/heads/main", displayId: "main" },
          reviewers: [],
        },
      );
    });

    test("GET current PR fails", async () => {
      mockReject(h.mockClients.api.get, new Error("fail"));
      const r = await callRaw(h.client, "update_pull_request", {
        project: "PROJ",
        repository: "my-repo",
        prId: 10,
        title: "New title",
      });
      expect(r.isError).toBe(true);
    });

    test("API error when GET current PR fails", async () => {
      mockReject(h.mockClients.api.get, new Error("fail"));
      const r = await callRaw(h.client, "update_pull_request", {
        project: "PROJ",
        repository: "my-repo",
        prId: 10,
        title: "New title",
      });
      expect(r.isError).toBe(true);
    });
  });
});
