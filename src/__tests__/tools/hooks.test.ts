import { describe, test, expect } from "vitest";
import { registerHookTools } from "../../tools/hooks.js";
import { mockJson, mockReject } from "../test-utils.js";
import {
  callAndParse,
  callRaw,
  expectCalledWithJson,
  setupToolHarness,
} from "../tool-test-utils.js";

describe("list_repository_hooks", () => {
  const h = setupToolHarness({
    register: registerHookTools,
    defaultProject: "D",
  });

  test("returns hooks", async () => {
    mockJson(h.mockClients.api.get, {
      values: [{ key: "hook1", enabled: true }],
      size: 1,
      isLastPage: true,
    });
    const p = await callAndParse<{ total: number }>(
      h.client,
      "list_repository_hooks",
      { project: "P", repository: "r" },
    );
    expect(p.total).toBe(1);
    expect(h.mockClients.api.get).toHaveBeenCalledWith(
      "projects/P/repos/r/settings/hooks",
      expect.objectContaining({ searchParams: { limit: 25, start: 0 } }),
    );
  });

  test("returns empty", async () => {
    mockJson(h.mockClients.api.get, { values: [], size: 0, isLastPage: true });
    const p = await callAndParse<{ total: number }>(
      h.client,
      "list_repository_hooks",
      { project: "P", repository: "r" },
    );
    expect(p.total).toBe(0);
  });

  test("API error", async () => {
    mockReject(h.mockClients.api.get, new Error("fail"));
    const r = await callRaw(h.client, "list_repository_hooks", {
      project: "P",
      repository: "r",
    });
    expect(r.isError).toBe(true);
  });

  test("uses default project when not provided", async () => {
    mockJson(h.mockClients.api.get, { values: [], size: 0, isLastPage: true });
    await callAndParse(h.client, "list_repository_hooks", {
      repository: "r",
    });
    expect(h.mockClients.api.get).toHaveBeenCalledWith(
      "projects/D/repos/r/settings/hooks",
      expect.anything(),
    );
  });
});

describe("manage_repository_hooks", () => {
  const h = setupToolHarness({
    register: registerHookTools,
    defaultProject: "D",
  });

  test.each([
    { action: "enable" as const, expectedEnabled: true },
    { action: "disable" as const, expectedEnabled: false },
  ])(
    "$action hook returns enabled=$expectedEnabled",
    async ({ action, expectedEnabled }) => {
      mockJson(h.mockClients.api.put, {});
      const p = await callAndParse<{ enabled: boolean }>(
        h.client,
        "manage_repository_hooks",
        { action, project: "P", repository: "r", hookKey: "hk" },
      );
      expect(p.enabled).toBe(expectedEnabled);
      expectCalledWithJson(
        h.mockClients.api.put,
        "projects/P/repos/r/settings/hooks/hk/settings",
        {},
      );
    },
  );

  test("configure hook", async () => {
    mockJson(h.mockClients.api.put, { ok: true });
    const p = await callAndParse<{ ok: boolean }>(
      h.client,
      "manage_repository_hooks",
      {
        action: "configure",
        project: "P",
        repository: "r",
        hookKey: "hk",
        settings: { x: 1 },
      },
    );
    expect(p.ok).toBe(true);
    expectCalledWithJson(
      h.mockClients.api.put,
      "projects/P/repos/r/settings/hooks/hk/settings",
      { x: 1 },
    );
  });

  test.each(["enable", "disable", "configure"] as const)(
    "$action error returns isError",
    async (action) => {
      mockReject(h.mockClients.api.put, new Error("fail"));
      const r = await callRaw(h.client, "manage_repository_hooks", {
        action,
        project: "P",
        repository: "r",
        hookKey: "hk",
      });
      expect(r.isError).toBe(true);
    },
  );
});
