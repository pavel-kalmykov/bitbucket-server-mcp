import { describe, test, expect } from "vitest";
import { registerRepositoryTools } from "../../tools/repositories.js";
import { mockJson } from "../test-utils.js";
import {
  callAndParse,
  callRaw,
  expectCalledWithJson,
  expectCalledWithSearchParams,
  setupToolHarness,
} from "../tool-test-utils.js";

describe("get_file_blame", () => {
  const h = setupToolHarness({
    register: registerRepositoryTools,
    defaultProject: "DEFAULT",
  });

  test("returns blame data for a file", async () => {
    mockJson(h.mockClients.api.get, { lines: [{ line: 1, author: "jdoe" }] });
    const parsed = await callAndParse<{ lines: Array<{ author: string }> }>(
      h.client,
      "get_file_blame",
      { project: "TEST", repository: "my-repo", filePath: "src/main.ts" },
    );
    expect(parsed.lines[0].author).toBe("jdoe");
    expectCalledWithSearchParams(
      h.mockClients.api.get,
      "projects/TEST/repos/my-repo/browse/src/main.ts",
      { blame: "" },
    );
  });

  test("passes branch in search params", async () => {
    mockJson(h.mockClients.api.get, { lines: [] });
    await callAndParse(h.client, "get_file_blame", {
      project: "TEST",
      repository: "my-repo",
      filePath: "src/main.ts",
      branch: "develop",
    });
    expectCalledWithSearchParams(
      h.mockClients.api.get,
      "projects/TEST/repos/my-repo/browse/src/main.ts",
      { blame: "", at: "develop" },
    );
  });

  test("uses default project", async () => {
    mockJson(h.mockClients.api.get, { lines: [] });
    await callAndParse(h.client, "get_file_blame", {
      repository: "my-repo",
      filePath: "src/main.ts",
    });
    expect(h.mockClients.api.get).toHaveBeenCalledWith(
      "projects/DEFAULT/repos/my-repo/browse/src/main.ts",
      expect.anything(),
    );
  });

  test("returns error on API failure", async () => {
    h.mockClients.api.get.mockRejectedValueOnce(new Error("Not found"));
    const result = await callRaw(h.client, "get_file_blame", {
      project: "TEST",
      repository: "my-repo",
      filePath: "src/main.ts",
    });
    expect(result.isError).toBe(true);
  });
});

describe("create_repository", () => {
  const h = setupToolHarness({
    register: registerRepositoryTools,
    defaultProject: "DEFAULT",
  });

  test("creates repo with name only", async () => {
    mockJson(h.mockClients.api.post, { slug: "new-repo", name: "new-repo" });
    const parsed = await callAndParse<{ slug: string }>(
      h.client,
      "create_repository",
      { project: "TEST", name: "new-repo" },
    );
    expect(parsed.slug).toBe("new-repo");
    expectCalledWithJson(h.mockClients.api.post, "projects/TEST/repos", {
      name: "new-repo",
    });
  });

  test("creates repo with description", async () => {
    mockJson(h.mockClients.api.post, { slug: "r", description: "desc" });
    await callAndParse(h.client, "create_repository", {
      project: "TEST",
      name: "r",
      description: "desc",
    });
    expectCalledWithJson(h.mockClients.api.post, "projects/TEST/repos", {
      name: "r",
      description: "desc",
    });
  });

  test("creates repo with defaultBranch", async () => {
    mockJson(h.mockClients.api.post, { slug: "r", defaultBranch: "develop" });
    await callAndParse(h.client, "create_repository", {
      project: "TEST",
      name: "r",
      defaultBranch: "develop",
    });
    expectCalledWithJson(h.mockClients.api.post, "projects/TEST/repos", {
      name: "r",
      defaultBranch: "develop",
    });
  });

  test("creates repo with all fields", async () => {
    mockJson(h.mockClients.api.post, { slug: "r" });
    await callAndParse(h.client, "create_repository", {
      project: "TEST",
      name: "r",
      description: "desc",
      defaultBranch: "main",
    });
    expectCalledWithJson(h.mockClients.api.post, "projects/TEST/repos", {
      name: "r",
      description: "desc",
      defaultBranch: "main",
    });
  });

  test("uses default project", async () => {
    mockJson(h.mockClients.api.post, { slug: "r" });
    await callAndParse(h.client, "create_repository", { name: "r" });
    expect(h.mockClients.api.post).toHaveBeenCalledWith(
      "projects/DEFAULT/repos",
      expect.anything(),
    );
  });

  test("returns error on API failure", async () => {
    h.mockClients.api.post.mockRejectedValueOnce(new Error("Conflict"));
    const result = await callRaw(h.client, "create_repository", {
      project: "TEST",
      name: "r",
    });
    expect(result.isError).toBe(true);
  });
});

describe("delete_repository", () => {
  const h = setupToolHarness({
    register: registerRepositoryTools,
    defaultProject: "DEFAULT",
  });

  test("deletes repo and returns result", async () => {
    mockJson(h.mockClients.api.delete, {});
    const parsed = await callAndParse<{ deleted: boolean; repository: string }>(
      h.client,
      "delete_repository",
      { project: "TEST", repository: "my-repo" },
    );
    expect(parsed.deleted).toBe(true);
    expect(parsed.repository).toBe("my-repo");
  });

  test("uses default project", async () => {
    mockJson(h.mockClients.api.delete, {});
    await callAndParse(h.client, "delete_repository", {
      repository: "my-repo",
    });
    expect(h.mockClients.api.delete).toHaveBeenCalled();
    const [url] = h.mockClients.api.delete.mock.calls[0];
    expect(url).toBe("projects/DEFAULT/repos/my-repo");
  });

  test("returns error on API failure", async () => {
    h.mockClients.api.delete.mockRejectedValueOnce(new Error("Forbidden"));
    const result = await callRaw(h.client, "delete_repository", {
      project: "TEST",
      repository: "my-repo",
    });
    expect(result.isError).toBe(true);
  });
});
