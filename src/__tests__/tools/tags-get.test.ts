import { describe, test, expect } from "vitest";
import { registerBranchTools } from "../../tools/branches.js";
import { mockJson } from "../test-utils.js";
import { callAndParse, callRaw, setupToolHarness } from "../tool-test-utils.js";

describe("get_tag", () => {
  const h = setupToolHarness({
    register: registerBranchTools,
    defaultProject: "DEFAULT",
  });

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
