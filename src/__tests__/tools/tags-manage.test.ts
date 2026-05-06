import { describe, test, expect } from "vitest";
import { registerBranchTools } from "../../tools/refs.js";
import { mockJson, mockVoid } from "../test-utils.js";
import { callAndParse, callRaw, setupToolHarness } from "../tool-test-utils.js";

describe("manage_tags", () => {
  const h = setupToolHarness({
    register: registerBranchTools,
    defaultProject: "DEFAULT",
  });

  describe("create", () => {
    test("creates a tag with required params", async () => {
      mockJson(h.mockClients.api.post, {
        id: "refs/tags/v1.0.0",
        displayId: "v1.0.0",
        hash: "abc123",
      });

      const parsed = await callAndParse<{
        id: string;
        displayId: string;
      }>(h.client, "manage_tags", {
        action: "create",
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

      await callAndParse(h.client, "manage_tags", {
        action: "create",
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

      await callAndParse(h.client, "manage_tags", {
        action: "create",
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

      const result = await callRaw(h.client, "manage_tags", {
        action: "create",
        project: "TEST",
        repository: "my-repo",
        name: "v1.0.0",
        startPoint: "abc123",
      });

      expect(result.isError).toBe(true);
    });
  });

  describe("delete", () => {
    test("deletes a tag by name", async () => {
      mockVoid(h.mockClients.git.delete);

      const parsed = await callAndParse<{ deleted: boolean; tag: string }>(
        h.client,
        "manage_tags",
        {
          action: "delete",
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

      await callAndParse(h.client, "manage_tags", {
        action: "delete",
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

      const result = await callRaw(h.client, "manage_tags", {
        action: "delete",
        project: "TEST",
        repository: "my-repo",
        name: "nonexistent",
      });

      expect(result.isError).toBe(true);
    });
  });
});
