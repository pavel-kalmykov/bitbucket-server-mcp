import { describe, test, expect } from "vitest";
import { registerProjectPermissionTools } from "../../../tools/project-permissions.js";
import { mockJson, mockReject } from "../../fixtures/test-utils.js";
import {
  callAndParse,
  callRaw,
  expectCalledWithSearchParams,
  setupToolHarness,
} from "../../fixtures/tool-test-utils.js";

describe("manage_project_permissions", () => {
  const h = setupToolHarness({
    register: registerProjectPermissionTools,
    defaultProject: "D",
  });

  test("list-groups returns curated entries", async () => {
    mockJson(h.mockClients.api.get, {
      values: [{ group: { name: "group_dev" }, permission: "PROJECT_WRITE" }],
      size: 1,
      limit: 25,
      isLastPage: true,
    });
    const parsed = await callAndParse<{
      permissions: Array<Record<string, unknown>>;
    }>(h.client, "manage_project_permissions", {
      action: "list-groups",
      project: "PRJ",
    });
    expect(parsed.permissions).toEqual([
      { name: "group_dev", permission: "PROJECT_WRITE" },
    ]);
    expectCalledWithSearchParams(
      h.mockClients.api.get,
      "projects/PRJ/permissions/groups",
      { limit: 25, start: 0 },
    );
  });

  test("list-users returns curated entries", async () => {
    mockJson(h.mockClients.api.get, {
      values: [{ user: { name: "admin" }, permission: "PROJECT_ADMIN" }],
      size: 1,
      limit: 25,
      isLastPage: true,
    });
    const parsed = await callAndParse<{
      permissions: Array<Record<string, unknown>>;
    }>(h.client, "manage_project_permissions", {
      action: "list-users",
      project: "PRJ",
    });
    expect(parsed.permissions).toEqual([
      { name: "admin", permission: "PROJECT_ADMIN" },
    ]);
    expectCalledWithSearchParams(
      h.mockClients.api.get,
      "projects/PRJ/permissions/users",
      { limit: 25, start: 0 },
    );
  });

  test("grant to a group puts the permission and name as query params", async () => {
    mockJson(h.mockClients.api.put, "");
    const parsed = await callAndParse<Record<string, unknown>>(
      h.client,
      "manage_project_permissions",
      {
        action: "grant",
        project: "PRJ",
        subject: "group",
        permission: "PROJECT_WRITE",
        name: "group_dev",
      },
    );
    expect(parsed.granted).toBe(true);
    expectCalledWithSearchParams(
      h.mockClients.api.put,
      "projects/PRJ/permissions/groups",
      { permission: "PROJECT_WRITE", name: "group_dev" },
    );
  });

  test("grant to a user hits the users endpoint", async () => {
    mockJson(h.mockClients.api.put, "");
    await callAndParse(h.client, "manage_project_permissions", {
      action: "grant",
      project: "PRJ",
      subject: "user",
      permission: "PROJECT_READ",
      name: "jdoe",
    });
    expectCalledWithSearchParams(
      h.mockClients.api.put,
      "projects/PRJ/permissions/users",
      { permission: "PROJECT_READ", name: "jdoe" },
    );
  });

  test("grant without permission fails", async () => {
    const result = await callRaw(h.client, "manage_project_permissions", {
      action: "grant",
      project: "PRJ",
      subject: "group",
      name: "group_dev",
    });
    expect(result.isError).toBe(true);
    expect(result.content[0].text).toContain("permission is required");
  });

  test("grant without subject fails", async () => {
    const result = await callRaw(h.client, "manage_project_permissions", {
      action: "grant",
      project: "PRJ",
      permission: "PROJECT_WRITE",
      name: "group_dev",
    });
    expect(result.isError).toBe(true);
    expect(result.content[0].text).toContain("subject is required");
  });

  test("grant without name fails", async () => {
    const result = await callRaw(h.client, "manage_project_permissions", {
      action: "grant",
      project: "PRJ",
      subject: "group",
      permission: "PROJECT_WRITE",
    });
    expect(result.isError).toBe(true);
    expect(result.content[0].text).toContain("name is required");
  });

  test("grant with an invalid permission fails validation", async () => {
    const result = await callRaw(h.client, "manage_project_permissions", {
      action: "grant",
      project: "PRJ",
      subject: "group",
      permission: "REPO_ADMIN",
      name: "group_dev",
    });
    expect(result.isError).toBe(true);
  });

  test("revoke deletes with the name as query param", async () => {
    mockJson(h.mockClients.api.delete, "");
    const parsed = await callAndParse<Record<string, unknown>>(
      h.client,
      "manage_project_permissions",
      {
        action: "revoke",
        project: "PRJ",
        subject: "group",
        name: "group_dev",
      },
    );
    expect(parsed.revoked).toBe(true);
    expect(h.mockClients.api.delete).toHaveBeenCalledWith(
      "projects/PRJ/permissions/groups",
      { searchParams: { name: "group_dev" } },
    );
  });

  test("revoke without name fails", async () => {
    const result = await callRaw(h.client, "manage_project_permissions", {
      action: "revoke",
      project: "PRJ",
      subject: "user",
    });
    expect(result.isError).toBe(true);
    expect(result.content[0].text).toContain("name is required");
  });

  test("returns error on API failure", async () => {
    mockReject(h.mockClients.api.post, new Error("fail"));
    mockReject(h.mockClients.api.get, new Error("fail"));
    const result = await callRaw(h.client, "manage_project_permissions", {
      action: "list-groups",
      project: "PRJ",
    });
    expect(result.isError).toBe(true);
  });

  test("fields '*all' returns the raw entry", async () => {
    mockJson(h.mockClients.api.get, {
      values: [{ group: { name: "g" }, permission: "PROJECT_READ", extra: 1 }],
      size: 1,
      limit: 25,
      isLastPage: true,
    });
    const parsed = await callAndParse<{
      permissions: Array<Record<string, unknown>>;
    }>(h.client, "manage_project_permissions", {
      action: "list-groups",
      project: "PRJ",
      fields: "*all",
    });
    expect(parsed.permissions).toEqual([
      { group: { name: "g" }, permission: "PROJECT_READ", extra: 1 },
    ]);
  });
});
