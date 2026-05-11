import { describe, test, expect } from "vitest";
import { registerWebhookTools } from "../../tools/webhooks.js";
import { mockJson } from "../test-utils.js";
import {
  callAndParse,
  callRaw,
  expectCalledWithJson,
  setupToolHarness,
} from "../tool-test-utils.js";

describe("list_webhooks", () => {
  const h = setupToolHarness({
    register: registerWebhookTools,
    defaultProject: "DEFAULT",
  });

  test("returns webhooks from the API", async () => {
    mockJson(h.mockClients.api.get, {
      values: [{ id: 1, name: "ci-hook", url: "https://ci.example.com/hook" }],
      size: 1,
      isLastPage: true,
    });

    const parsed = await callAndParse<{
      total: number;
      webhooks: Array<{ id: number; name: string }>;
    }>(h.client, "list_webhooks", {
      project: "TEST",
      repository: "my-repo",
    });

    expect(parsed.total).toBe(1);
    expect(parsed.webhooks[0].name).toBe("ci-hook");
  });

  test("returns empty list", async () => {
    mockJson(h.mockClients.api.get, {
      values: [],
      size: 0,
      isLastPage: true,
    });

    const parsed = await callAndParse<{ total: number }>(
      h.client,
      "list_webhooks",
      {
        project: "TEST",
        repository: "my-repo",
      },
    );

    expect(parsed.total).toBe(0);
  });

  test("returns error on API failure", async () => {
    h.mockClients.api.get.mockRejectedValueOnce(new Error("Forbidden"));

    const result = await callRaw(h.client, "list_webhooks", {
      project: "TEST",
      repository: "my-repo",
    });

    expect(result.isError).toBe(true);
  });
});

describe("manage_webhooks", () => {
  const h = setupToolHarness({
    register: registerWebhookTools,
    defaultProject: "DEFAULT",
  });

  test("creates a webhook", async () => {
    mockJson(h.mockClients.api.post, { id: 1, name: "my-hook" });

    const parsed = await callAndParse<{ id: number }>(
      h.client,
      "manage_webhooks",
      {
        action: "create",
        project: "TEST",
        repository: "my-repo",
        name: "my-hook",
        url: "https://example.com/hook",
        events: ["repo:refs_changed"],
      },
    );

    expect(parsed.id).toBe(1);
    expectCalledWithJson(
      h.mockClients.api.post,
      "projects/TEST/repos/my-repo/webhooks",
      {
        name: "my-hook",
        url: "https://example.com/hook",
        events: ["repo:refs_changed"],
      },
    );
  });

  test("creates a webhook with active: false", async () => {
    mockJson(h.mockClients.api.post, {
      id: 2,
      name: "disabled-hook",
      active: false,
    });

    await callAndParse(h.client, "manage_webhooks", {
      action: "create",
      project: "TEST",
      repository: "my-repo",
      name: "disabled-hook",
      url: "https://example.com/hook",
      active: false,
    });

    expectCalledWithJson(
      h.mockClients.api.post,
      "projects/TEST/repos/my-repo/webhooks",
      {
        name: "disabled-hook",
        url: "https://example.com/hook",
        active: false,
      },
    );
  });

  test("updates a webhook", async () => {
    mockJson(h.mockClients.api.put, { id: 1, name: "updated-hook" });

    const parsed = await callAndParse<{ name: string }>(
      h.client,
      "manage_webhooks",
      {
        action: "update",
        project: "TEST",
        repository: "my-repo",
        webhookId: 1,
        name: "updated-hook",
      },
    );

    expect(parsed.name).toBe("updated-hook");
    expectCalledWithJson(
      h.mockClients.api.put,
      "projects/TEST/repos/my-repo/webhooks/1",
      { name: "updated-hook" },
    );
  });

  test("updates a webhook with all fields", async () => {
    mockJson(h.mockClients.api.put, {
      id: 1,
      name: "h",
      url: "u",
      active: true,
    });

    await callAndParse(h.client, "manage_webhooks", {
      action: "update",
      project: "TEST",
      repository: "my-repo",
      webhookId: 1,
      name: "h",
      url: "u",
      events: ["repo:refs_changed"],
      active: true,
    });

    expectCalledWithJson(
      h.mockClients.api.put,
      "projects/TEST/repos/my-repo/webhooks/1",
      {
        name: "h",
        url: "u",
        events: ["repo:refs_changed"],
        active: true,
      },
    );
  });

  test("updates a webhook with url only", async () => {
    mockJson(h.mockClients.api.put, {
      id: 1,
      url: "https://new.example.com/hook",
    });

    await callAndParse(h.client, "manage_webhooks", {
      action: "update",
      project: "TEST",
      repository: "my-repo",
      webhookId: 1,
      url: "https://new.example.com/hook",
    });

    expectCalledWithJson(
      h.mockClients.api.put,
      "projects/TEST/repos/my-repo/webhooks/1",
      { url: "https://new.example.com/hook" },
    );
  });

  test("deletes a webhook", async () => {
    mockJson(h.mockClients.api.delete, {});

    const parsed = await callAndParse<{ deleted: boolean; webhookId: number }>(
      h.client,
      "manage_webhooks",
      {
        action: "delete",
        project: "TEST",
        repository: "my-repo",
        webhookId: 1,
      },
    );

    expect(parsed.deleted).toBe(true);
    expect(parsed.webhookId).toBe(1);
  });

  test("returns error when create fails", async () => {
    h.mockClients.api.post.mockRejectedValueOnce(new Error("Invalid URL"));

    const result = await callRaw(h.client, "manage_webhooks", {
      action: "create",
      project: "TEST",
      repository: "my-repo",
      name: "hook",
      url: "invalid",
    });

    expect(result.isError).toBe(true);
  });
});
