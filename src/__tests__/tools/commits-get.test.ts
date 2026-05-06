import { describe, test, expect } from "vitest";
import { registerBranchTools } from "../../tools/refs.js";
import { mockJson } from "../test-utils.js";
import { callAndParse, callRaw, setupToolHarness } from "../tool-test-utils.js";

describe("get_commit", () => {
  const h = setupToolHarness({
    register: registerBranchTools,
    defaultProject: "DEFAULT",
  });

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
    h.mockClients.api.get.mockRejectedValueOnce(new Error("Commit not found"));

    const result = await callRaw(h.client, "get_commit", {
      project: "TEST",
      repository: "my-repo",
      commitId: "nonexistent",
    });

    expect(result.isError).toBe(true);
  });
});
