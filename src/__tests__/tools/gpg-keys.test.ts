import { describe, test, expect } from "vitest";
import { registerGpgKeyTools } from "../../tools/gpg-keys.js";
import { mockJson, mockReject } from "../test-utils.js";
import {
  callAndParse,
  callRaw,
  expectCalledWithJson,
  expectCalledWithSearchParams,
  setupToolHarness,
} from "../tool-test-utils.js";

describe("list_gpg_keys", () => {
  const h = setupToolHarness({
    register: registerGpgKeyTools,
    defaultProject: "D",
  });

  test("returns full response shape", async () => {
    mockJson(h.mockClients.gpg.get, {
      values: [{ id: 1 }, { id: 2 }],
      size: 2,
      isLastPage: false,
    });
    const p = await callAndParse<{
      total: number;
      keys: unknown[];
      isLastPage: boolean;
    }>(h.client, "list_gpg_keys", {});
    expect(p.total).toBe(2);
    expect(p.keys).toEqual([{ id: 1 }, { id: 2 }]);
    expect(p.isLastPage).toBe(false);
  });

  test("defaults limit to 25 and start to 0", async () => {
    mockJson(h.mockClients.gpg.get, {
      values: [],
      size: 0,
      isLastPage: true,
    });
    await callAndParse(h.client, "list_gpg_keys", {});
    expectCalledWithSearchParams(h.mockClients.gpg.get, "keys", {
      limit: 25,
      start: 0,
    });
  });

  test("forwards userSlug as user searchParam", async () => {
    mockJson(h.mockClients.gpg.get, {
      values: [],
      size: 0,
      isLastPage: true,
    });
    await callAndParse(h.client, "list_gpg_keys", { userSlug: "alice" });
    expectCalledWithSearchParams(h.mockClients.gpg.get, "keys", {
      limit: 25,
      start: 0,
      user: "alice",
    });
  });

  test("omits user searchParam when userSlug not provided", async () => {
    mockJson(h.mockClients.gpg.get, {
      values: [],
      size: 0,
      isLastPage: true,
    });
    await callAndParse(h.client, "list_gpg_keys", {});
    const callArgs = h.mockClients.gpg.get.mock.calls[0];
    const opts = callArgs[1] as { searchParams: Record<string, unknown> };
    expect(opts.searchParams).not.toHaveProperty("user");
  });

  test("API error", async () => {
    mockReject(h.mockClients.gpg.get, new Error("fail"));
    const r = await callRaw(h.client, "list_gpg_keys", {});
    expect(r.isError).toBe(true);
  });
});

describe("manage_gpg_keys", () => {
  const h = setupToolHarness({
    register: registerGpgKeyTools,
    defaultProject: "D",
  });

  test("add key", async () => {
    mockJson(h.mockClients.gpg.post, { id: 1 });
    const p = await callAndParse<{ id: number }>(h.client, "manage_gpg_keys", {
      action: "add",
      text: "-----BEGIN...",
    });
    expect(p.id).toBe(1);
    expectCalledWithJson(h.mockClients.gpg.post, "keys", {
      text: "-----BEGIN...",
    });
  });

  test("delete key constructs URL and returns keyId", async () => {
    mockJson(h.mockClients.gpg.delete, {});
    const p = await callAndParse<{
      deleted: boolean;
      keyId: number;
    }>(h.client, "manage_gpg_keys", { action: "delete", keyId: 42 });
    expect(p.deleted).toBe(true);
    expect(p.keyId).toBe(42);
    expect(h.mockClients.gpg.delete).toHaveBeenCalledWith("keys/42");
  });

  test("add error", async () => {
    mockReject(h.mockClients.gpg.post, new Error("fail"));
    const r = await callRaw(h.client, "manage_gpg_keys", {
      action: "add",
      text: "bad",
    });
    expect(r.isError).toBe(true);
  });

  test("delete error", async () => {
    mockReject(h.mockClients.gpg.delete, new Error("fail"));
    const r = await callRaw(h.client, "manage_gpg_keys", {
      action: "delete",
      keyId: 1,
    });
    expect(r.isError).toBe(true);
  });
});
