import { describe, test, expect } from "vitest";
import { registerForkTools } from "../../tools/forks.js";
import { mockJson } from "../test-utils.js";
import {
  callAndParse,
  callRaw,
  expectCalledWithJson,
  setupToolHarness,
} from "../tool-test-utils.js";

describe("fork_repository", () => {
  const h = setupToolHarness({
    register: registerForkTools,
    defaultProject: "DEFAULT",
  });

  test("creates a fork with default name and target project", async () => {
    mockJson(h.mockClients.api.post, {
      slug: "my-repo",
      id: 2,
      name: "my-repo",
      project: { key: "~user", name: "User" },
    });

    const parsed = await callAndParse<{ slug: string }>(
      h.client,
      "fork_repository",
      {
        project: "SRC",
        repository: "my-repo",
      },
    );

    expect(parsed.slug).toBe("my-repo");
    expectCalledWithJson(
      h.mockClients.api.post,
      "projects/SRC/repos/my-repo",
      {},
    );
  });

  test("creates a fork with custom name and target project", async () => {
    mockJson(h.mockClients.api.post, {
      slug: "my-fork",
      project: { key: "TARGET" },
    });

    const parsed = await callAndParse<{ slug: string }>(
      h.client,
      "fork_repository",
      {
        project: "SRC",
        repository: "my-repo",
        name: "my-fork",
        target_project: "TARGET",
      },
    );

    expect(parsed.slug).toBe("my-fork");
    expectCalledWithJson(h.mockClients.api.post, "projects/SRC/repos/my-repo", {
      name: "my-fork",
      project: { key: "TARGET" },
    });
  });

  test("creates a fork with name only, no target project", async () => {
    mockJson(h.mockClients.api.post, {
      slug: "my-fork",
      project: { key: "SRC" },
    });

    await callAndParse(h.client, "fork_repository", {
      project: "SRC",
      repository: "my-repo",
      name: "my-fork",
    });

    expectCalledWithJson(h.mockClients.api.post, "projects/SRC/repos/my-repo", {
      name: "my-fork",
    });
  });

  test("creates a fork with target_project only, no custom name", async () => {
    mockJson(h.mockClients.api.post, {
      slug: "my-repo",
      project: { key: "TARGET" },
    });

    await callAndParse(h.client, "fork_repository", {
      project: "SRC",
      repository: "my-repo",
      target_project: "TARGET",
    });

    expectCalledWithJson(h.mockClients.api.post, "projects/SRC/repos/my-repo", {
      project: { key: "TARGET" },
    });
  });

  test("uses default project when not provided", async () => {
    mockJson(h.mockClients.api.post, {
      slug: "my-repo",
      project: { key: "~user" },
    });

    await callAndParse(h.client, "fork_repository", {
      repository: "my-repo",
    });

    expect(h.mockClients.api.post).toHaveBeenCalledWith(
      "projects/DEFAULT/repos/my-repo",
      expect.anything(),
    );
  });

  test("returns error when API call fails", async () => {
    h.mockClients.api.post.mockRejectedValueOnce(new Error("Conflict"));

    const result = await callRaw(h.client, "fork_repository", {
      project: "SRC",
      repository: "my-repo",
    });

    expect(result.isError).toBe(true);
  });
});
