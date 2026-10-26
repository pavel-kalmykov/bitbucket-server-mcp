import { describe, test, expect } from "vitest";
import { registerRepositoryPermissionTools } from "../../../tools/repository-permissions.js";
import { mockJson, mockReject } from "../../fixtures/test-utils.js";
import {
  callAndParse,
  callRaw,
  expectCalledWithSearchParams,
  setupToolHarness,
} from "../../fixtures/tool-test-utils.js";

describe("manage_repository_permissions", () => {
  const h = setupToolHarness({
    register: registerRepositoryPermissionTools,
    defaultProject: "D",
  });

  test("list-groups returns curated entries", async () => {
    mockJson(h.mockClients.api.get, {
      values: [{ group: { name: "group_dev" }, permission: "REPO_WRITE" }],
      size: 1,
      limit: 25,
      isLastPage: true,
    });
    const parsed = await callAndParse<{
      permissions: Array<Record<string, unknown>>;
    }>(h.client, "manage_repository_permissions", {
      action: "list-groups",
      project: "PRJ",
      repository: "r",
    });
    expect(parsed.permissions).toEqual([
      { name: "group_dev", permission: "REPO_WRITE" },
    ]);
    expectCalledWithSearchParams(
      h.mockClients.api.get,
      "projects/PRJ/repos/r/permissions/groups",
      { limit: 25, start: 0 },
    );
  });

  test("list-users returns curated entries", async () => {
    mockJson(h.mockClients.api.get, {
      values: [{ user: { name: "admin" }, permission: "REPO_ADMIN" }],
      size: 1,
      limit: 25,
      isLastPage: true,
    });
    const parsed = await callAndParse<{
      permissions: Array<Record<string, unknown>>;
    }>(h.client, "manage_repository_permissions", {
      action: "list-users",
      repository: "r",
    });
    expect(parsed.permissions).toEqual([
      { name: "admin", permission: "REPO_ADMIN" },
    ]);
    expectCalledWithSearchParams(
      h.mockClients.api.get,
      "projects/D/repos/r/permissions/users",
      { limit: 25, start: 0 },
    );
  });

  test("grant batches several group names in one call", async () => {
    mockJson(h.mockClients.api.put, "");
    const parsed = await callAndParse<Record<string, unknown>>(
      h.client,
      "manage_repository_permissions",
      {
        action: "grant",
        project: "PRJ",
        repository: "r",
        subject: "group",
        permission: "REPO_WRITE",
        names: ["group_a", "group_b"],
      },
    );
    expect(parsed.granted).toBe(true);
    expect(parsed.names).toEqual(["group_a", "group_b"]);
    const [url, options] = h.mockClients.api.put.mock.calls[0] as [
      string,
      { searchParams: URLSearchParams },
    ];
    expect(url).toBe("projects/PRJ/repos/r/permissions/groups");
    expect(options.searchParams.get("permission")).toBe("REPO_WRITE");
    expect(options.searchParams.getAll("name")).toEqual(["group_a", "group_b"]);
  });

  test("grant to a user hits the users endpoint", async () => {
    mockJson(h.mockClients.api.put, "");
    await callAndParse(h.client, "manage_repository_permissions", {
      action: "grant",
      repository: "r",
      subject: "user",
      permission: "REPO_READ",
      names: ["jdoe"],
    });
    const [url, options] = h.mockClients.api.put.mock.calls[0] as [
      string,
      { searchParams: URLSearchParams },
    ];
    expect(url).toBe("projects/D/repos/r/permissions/users");
    expect(options.searchParams.get("permission")).toBe("REPO_READ");
    expect(options.searchParams.getAll("name")).toEqual(["jdoe"]);
  });

  test("grant without permission fails", async () => {
    const result = await callRaw(h.client, "manage_repository_permissions", {
      action: "grant",
      repository: "r",
      subject: "group",
      names: ["group_a"],
    });
    expect(result.isError).toBe(true);
    expect(result.content[0].text).toContain("permission is required");
  });

  test("grant without names fails", async () => {
    const result = await callRaw(h.client, "manage_repository_permissions", {
      action: "grant",
      repository: "r",
      subject: "group",
      permission: "REPO_READ",
    });
    expect(result.isError).toBe(true);
    expect(result.content[0].text).toContain("names is required");
  });

  test("grant without subject fails", async () => {
    const result = await callRaw(h.client, "manage_repository_permissions", {
      action: "grant",
      repository: "r",
      permission: "REPO_READ",
      names: ["group_a"],
    });
    expect(result.isError).toBe(true);
    expect(result.content[0].text).toContain("subject is required");
  });

  test("grant with an invalid permission fails validation", async () => {
    const result = await callRaw(h.client, "manage_repository_permissions", {
      action: "grant",
      repository: "r",
      subject: "group",
      permission: "PROJECT_ADMIN",
      names: ["group_a"],
    });
    expect(result.isError).toBe(true);
  });

  test("revoke deletes with the name as query param", async () => {
    mockJson(h.mockClients.api.delete, "");
    const parsed = await callAndParse<Record<string, unknown>>(
      h.client,
      "manage_repository_permissions",
      {
        action: "revoke",
        project: "PRJ",
        repository: "r",
        subject: "group",
        name: "group_dev",
      },
    );
    expect(parsed.revoked).toBe(true);
    expect(h.mockClients.api.delete).toHaveBeenCalledWith(
      "projects/PRJ/repos/r/permissions/groups",
      { searchParams: { name: "group_dev" } },
    );
  });

  test("revoke without name fails", async () => {
    const result = await callRaw(h.client, "manage_repository_permissions", {
      action: "revoke",
      repository: "r",
      subject: "user",
    });
    expect(result.isError).toBe(true);
    expect(result.content[0].text).toContain("name is required");
  });

  test("the schema rejects a call without repository", async () => {
    const result = await callRaw(h.client, "manage_repository_permissions", {
      action: "revoke",
      subject: "user",
      name: "jdoe",
    });
    expect(result.isError).toBe(true);
    expect(result.content[0].text).toContain("repository");
  });

  test("revoke of a user deletes on the users endpoint", async () => {
    mockJson(h.mockClients.api.delete, "");
    const parsed = await callAndParse<Record<string, unknown>>(
      h.client,
      "manage_repository_permissions",
      {
        action: "revoke",
        project: "PRJ",
        repository: "r",
        subject: "user",
        name: "jdoe",
      },
    );
    expect(parsed).toEqual({ revoked: true, name: "jdoe" });
    expect(h.mockClients.api.delete).toHaveBeenCalledWith(
      "projects/PRJ/repos/r/permissions/users",
      { searchParams: { name: "jdoe" } },
    );
  });

  test("list passes the filter as a query param", async () => {
    mockJson(h.mockClients.api.get, {
      values: [],
      size: 0,
      limit: 25,
      isLastPage: true,
    });
    await callAndParse(h.client, "manage_repository_permissions", {
      action: "list-users",
      repository: "r",
      filter: "adm",
    });
    expectCalledWithSearchParams(
      h.mockClients.api.get,
      "projects/D/repos/r/permissions/users",
      { filter: "adm", limit: 25, start: 0 },
    );
  });

  test("returns error on API failure", async () => {
    mockReject(h.mockClients.api.get, new Error("fail"));
    const result = await callRaw(h.client, "manage_repository_permissions", {
      action: "list-groups",
      repository: "r",
    });
    expect(result.isError).toBe(true);
  });

  test("fields '*all' returns the raw entry", async () => {
    mockJson(h.mockClients.api.get, {
      values: [{ group: { name: "g" }, permission: "REPO_READ", extra: 1 }],
      size: 1,
      limit: 25,
      isLastPage: true,
    });
    const parsed = await callAndParse<{
      permissions: Array<Record<string, unknown>>;
    }>(h.client, "manage_repository_permissions", {
      action: "list-groups",
      repository: "r",
      fields: "*all",
    });
    expect(parsed.permissions).toEqual([
      { group: { name: "g" }, permission: "REPO_READ", extra: 1 },
    ]);
  });
});
