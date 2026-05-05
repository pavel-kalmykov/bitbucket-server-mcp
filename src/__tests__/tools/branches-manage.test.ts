import { describe, test, expect } from "vitest";
import { registerBranchTools } from "../../tools/branches.js";
import { mockJson } from "../test-utils.js";
import {
  callAndParse,
  callRaw,
  expectCalledWith,
  setupToolHarness,
} from "../tool-test-utils.js";

describe("manage_branches", () => {
  const h = setupToolHarness({
    register: registerBranchTools,
    defaultProject: "DEFAULT",
  });

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
