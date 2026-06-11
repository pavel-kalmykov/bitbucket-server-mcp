import { describe, test, expect } from "vitest";
import { registerWebhookTools } from "../../tools/webhooks.js";
import { mockJson, mockReject } from "../test-utils.js";
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
    expect(h.mockClients.api.get).toHaveBeenCalledWith(
      "projects/TEST/repos/my-repo/webhooks",
      expect.objectContaining({ searchParams: { limit: 25, start: 0 } }),
    );
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
    mockReject(h.mockClients.api.get, new Error("Forbidden"));

    const result = await callRaw(h.client, "list_webhooks", {
      project: "TEST",
      repository: "my-repo",
    });

    expect(result.isError).toBe(true);
  });

  test("returns isLastPage false for multi-page responses", async () => {
    mockJson(h.mockClients.api.get, {
      values: [{ id: 1, name: "hook" }],
      size: 100,
      isLastPage: false,
    });

    const parsed = await callAndParse<{ total: number; isLastPage: boolean }>(
      h.client,
      "list_webhooks",
      {
        project: "TEST",
        repository: "my-repo",
      },
    );

    expect(parsed.total).toBe(100);
    expect(parsed.isLastPage).toBe(false);
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

  test("creates a webhook without active omits it from body", async () => {
    mockJson(h.mockClients.api.post, { id: 3, name: "no-active" });

    await callAndParse(h.client, "manage_webhooks", {
      action: "create",
      project: "TEST",
      repository: "my-repo",
      name: "no-active",
      url: "https://example.com/hook",
      events: ["repo:refs_changed"],
    });

    expect(h.mockClients.api.post).toHaveBeenCalledWith(
      expect.any(String),
      expect.objectContaining({
        json: expect.not.objectContaining({ active: expect.anything() }),
      }),
    );
  });

  test.each([
    {
      description: "name only",
      extraArgs: { name: "updated-hook" },
      expectedJson: { name: "updated-hook" },
    },
    {
      description: "all fields",
      extraArgs: {
        name: "h",
        url: "u",
        events: ["repo:refs_changed"],
        active: true,
      },
      expectedJson: {
        name: "h",
        url: "u",
        events: ["repo:refs_changed"],
        active: true,
      },
    },
    {
      description: "url only",
      extraArgs: { url: "https://new.example.com/hook" },
      expectedJson: { url: "https://new.example.com/hook" },
    },
    {
      description: "events only",
      extraArgs: { events: ["repo:refs_changed"] },
      expectedJson: { events: ["repo:refs_changed"] },
    },
    { description: "empty body", extraArgs: {}, expectedJson: {} },
  ])(
    "updates a webhook with $description",
    async ({ extraArgs, expectedJson }) => {
      mockJson(h.mockClients.api.put, { id: 1 });
      await callAndParse(h.client, "manage_webhooks", {
        action: "update",
        project: "TEST",
        repository: "my-repo",
        webhookId: 1,
        ...extraArgs,
      });
      expectCalledWithJson(
        h.mockClients.api.put,
        "projects/TEST/repos/my-repo/webhooks/1",
        expectedJson,
      );
    },
  );

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

  test.each([
    {
      action: "create" as const,
      mockMethod: "post" as const,
      extraArgs: { name: "hook", url: "invalid" },
    },
    {
      action: "update" as const,
      mockMethod: "put" as const,
      extraArgs: { webhookId: 999, name: "hook" },
    },
    {
      action: "delete" as const,
      mockMethod: "delete" as const,
      extraArgs: { webhookId: 999 },
    },
  ])(
    "returns error when $action fails",
    async ({ action, mockMethod, extraArgs }) => {
      mockReject(h.mockClients.api[mockMethod], new Error("fail"));
      const result = await callRaw(h.client, "manage_webhooks", {
        action,
        project: "TEST",
        repository: "my-repo",
        ...extraArgs,
      });
      expect(result.isError).toBe(true);
    },
  );
});
