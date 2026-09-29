import { describe, test, expect } from "vitest";
import { registerProjectTools } from "../../../tools/projects.js";
import { mockJson, mockReject } from "../../fixtures/test-utils.js";
import {
  callAndParse,
  callRaw,
  expectCalledWithJson,
  setupToolHarness,
} from "../../fixtures/tool-test-utils.js";

describe("manage_projects", () => {
  const h = setupToolHarness({
    register: registerProjectTools,
    defaultProject: "DEFAULT",
  });

  test("create posts name and key, returns the curated project", async () => {
    mockJson(h.mockClients.api.post, {
      id: 7,
      key: "PRJ",
      name: "My Project",
      description: "d",
      type: "NORMAL",
      public: false,
      links: { self: [] },
    });
    const parsed = await callAndParse<Record<string, unknown>>(
      h.client,
      "manage_projects",
      { action: "create", name: "My Project", key: "prj" },
    );
    expect(parsed).toEqual({
      id: 7,
      key: "PRJ",
      name: "My Project",
      description: "d",
      type: "NORMAL",
      public: false,
    });
    expectCalledWithJson(h.mockClients.api.post, "projects", {
      name: "My Project",
      key: "prj",
    });
  });

  test("create accepts description and public", async () => {
    mockJson(h.mockClients.api.post, { key: "PRJ" });
    await callAndParse(h.client, "manage_projects", {
      action: "create",
      name: "My Project",
      key: "prj",
      description: "hello",
      public: true,
    });
    expectCalledWithJson(h.mockClients.api.post, "projects", {
      name: "My Project",
      key: "prj",
      description: "hello",
      public: true,
    });
  });

  test("create without name fails with a validation error", async () => {
    const result = await callRaw(h.client, "manage_projects", {
      action: "create",
      key: "prj",
    });
    expect(result.isError).toBe(true);
    expect(result.content[0].text).toContain("name is required");
  });

  test("create without key fails with a validation error", async () => {
    const result = await callRaw(h.client, "manage_projects", {
      action: "create",
      name: "My Project",
    });
    expect(result.isError).toBe(true);
    expect(result.content[0].text).toContain("key is required");
  });

  test("update puts the changed fields on the project", async () => {
    mockJson(h.mockClients.api.put, { key: "PRJ", description: "new" });
    const parsed = await callAndParse<Record<string, unknown>>(
      h.client,
      "manage_projects",
      { action: "update", project: "prj", description: "new" },
    );
    expect(parsed.description).toBe("new");
    expectCalledWithJson(h.mockClients.api.put, "projects/prj", {
      description: "new",
    });
  });

  test("update without project fails with a validation error", async () => {
    const result = await callRaw(h.client, "manage_projects", {
      action: "update",
      description: "new",
    });
    expect(result.isError).toBe(true);
    expect(result.content[0].text).toContain("project is required");
  });

  test("delete removes the project and echoes the key", async () => {
    mockJson(h.mockClients.api.delete, {});
    const parsed = await callAndParse<{ deleted: boolean; project: string }>(
      h.client,
      "manage_projects",
      { action: "delete", project: "prj" },
    );
    expect(parsed.deleted).toBe(true);
    expect(parsed.project).toBe("prj");
    expect(h.mockClients.api.delete).toHaveBeenCalledWith("projects/prj");
  });

  test("delete without project fails with a validation error", async () => {
    const result = await callRaw(h.client, "manage_projects", {
      action: "delete",
    });
    expect(result.isError).toBe(true);
    expect(result.content[0].text).toContain("project is required");
  });

  test("create keeps an explicit public:false in the body", async () => {
    mockJson(h.mockClients.api.post, { key: "PRJ" });
    await callAndParse(h.client, "manage_projects", {
      action: "create",
      name: "My Project",
      key: "prj",
      public: false,
    });
    expectCalledWithJson(h.mockClients.api.post, "projects", {
      name: "My Project",
      key: "prj",
      public: false,
    });
  });

  test("update with no fields sends an empty body", async () => {
    mockJson(h.mockClients.api.put, { key: "PRJ" });
    await callAndParse(h.client, "manage_projects", {
      action: "update",
      project: "prj",
    });
    expectCalledWithJson(h.mockClients.api.put, "projects/prj", {});
  });

  test("fields param narrows the created project", async () => {
    mockJson(h.mockClients.api.post, {
      id: 7,
      key: "PRJ",
      name: "My Project",
      links: { self: [] },
    });
    const parsed = await callAndParse<Record<string, unknown>>(
      h.client,
      "manage_projects",
      { action: "create", name: "My Project", key: "prj", fields: "key" },
    );
    expect(parsed).toEqual({ key: "PRJ" });
  });

  test("fields '*all' returns the raw response", async () => {
    mockJson(h.mockClients.api.post, {
      id: 7,
      key: "PRJ",
      links: { self: [] },
    });
    const parsed = await callAndParse<{ links: unknown }>(
      h.client,
      "manage_projects",
      {
        action: "create",
        name: "My Project",
        key: "prj",
        fields: "*all",
      },
    );
    expect(parsed.links).toEqual({ self: [] });
  });

  test("returns error on API failure", async () => {
    mockReject(h.mockClients.api.post, new Error("fail"));
    const result = await callRaw(h.client, "manage_projects", {
      action: "create",
      name: "My Project",
      key: "prj",
    });
    expect(result.isError).toBe(true);
  });
});
