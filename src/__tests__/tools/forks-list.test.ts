import { describe, test, expect } from "vitest";
import { registerForkTools } from "../../tools/forks.js";
import { mockJson } from "../test-utils.js";
import {
  callAndParse,
  callRaw,
  expectCalledWithSearchParams,
  setupToolHarness,
} from "../tool-test-utils.js";

describe("list_forks", () => {
  const h = setupToolHarness({
    register: registerForkTools,
    defaultProject: "DEFAULT",
  });

  test("returns forks from the API", async () => {
    mockJson(h.mockClients.api.get, {
      values: [
        {
          slug: "fork-1",
          id: 1,
          name: "Fork 1",
          project: { key: "PROJ", name: "Project" },
        },
        {
          slug: "fork-2",
          id: 2,
          name: "Fork 2",
          project: { key: "PROJ", name: "Project" },
        },
      ],
      size: 2,
      isLastPage: true,
    });

    const parsed = await callAndParse<{
      total: number;
      forks: Array<{ slug: string; name: string }>;
    }>(h.client, "list_forks", {
      project: "TEST",
      repository: "my-repo",
    });

    expect(parsed.total).toBe(2);
    expect(parsed.forks).toHaveLength(2);
    expect(parsed.forks[0].slug).toBe("fork-1");
    expect(parsed.forks[1].name).toBe("Fork 2");
  });

  test("passes limit and start as search params", async () => {
    mockJson(h.mockClients.api.get, {
      values: [],
      size: 0,
      isLastPage: true,
    });

    await callAndParse(h.client, "list_forks", {
      project: "TEST",
      repository: "my-repo",
      limit: 10,
      start: 5,
    });

    expectCalledWithSearchParams(
      h.mockClients.api.get,
      "projects/TEST/repos/my-repo/forks",
      { limit: 10, start: 5 },
    );
  });

  test("uses default project when not provided", async () => {
    mockJson(h.mockClients.api.get, {
      values: [],
      size: 0,
      isLastPage: true,
    });

    await callAndParse(h.client, "list_forks", { repository: "my-repo" });

    expect(h.mockClients.api.get).toHaveBeenCalledWith(
      "projects/DEFAULT/repos/my-repo/forks",
      expect.anything(),
    );
  });

  test("returns raw output when fields is '*all'", async () => {
    mockJson(h.mockClients.api.get, {
      values: [{ slug: "fork-1", extra: "kept" }],
      size: 1,
      isLastPage: true,
    });

    const parsed = await callAndParse<{
      forks: Array<{ extra: string }>;
    }>(h.client, "list_forks", {
      project: "TEST",
      repository: "my-repo",
      fields: "*all",
    });

    expect(parsed.forks[0].extra).toBe("kept");
  });

  test("returns custom fields subset when fields is provided", async () => {
    mockJson(h.mockClients.api.get, {
      values: [{ slug: "fork-1", name: "Fork 1", description: "Desc" }],
      size: 1,
      isLastPage: true,
    });

    const parsed = await callAndParse<{
      forks: Array<{ slug: string; name: string }>;
    }>(h.client, "list_forks", {
      project: "TEST",
      repository: "my-repo",
      fields: "slug,name",
    });

    expect(parsed.forks[0].slug).toBe("fork-1");
    expect(parsed.forks[0].name).toBe("Fork 1");
    expect(parsed.forks[0]).not.toHaveProperty("description");
  });

  test("returns empty list when no forks exist", async () => {
    mockJson(h.mockClients.api.get, {
      values: [],
      size: 0,
      isLastPage: true,
    });

    const parsed = await callAndParse<{ total: number; forks: unknown[] }>(
      h.client,
      "list_forks",
      {
        project: "TEST",
        repository: "my-repo",
      },
    );

    expect(parsed.total).toBe(0);
    expect(parsed.forks).toHaveLength(0);
  });

  test("returns isLastPage false for multi-page responses", async () => {
    mockJson(h.mockClients.api.get, {
      values: [{ slug: "fork-1", id: 1, name: "Fork 1" }],
      size: 100,
      isLastPage: false,
    });

    const parsed = await callAndParse<{
      total: number;
      isLastPage: boolean;
    }>(h.client, "list_forks", {
      project: "TEST",
      repository: "my-repo",
    });

    expect(parsed.total).toBe(100);
    expect(parsed.isLastPage).toBe(false);
  });

  test("returns error when API call fails", async () => {
    h.mockClients.api.get.mockRejectedValueOnce(new Error("Not found"));

    const result = await callRaw(h.client, "list_forks", {
      project: "TEST",
      repository: "my-repo",
    });

    expect(result.isError).toBe(true);
  });
});
