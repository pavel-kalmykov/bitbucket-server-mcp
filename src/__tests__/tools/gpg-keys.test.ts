import { describe, test, expect } from "vitest";
import { registerGpgKeyTools } from "../../tools/gpg-keys.js";
import { mockJson } from "../test-utils.js";
import {
  callAndParse,
  callRaw,
  expectCalledWithJson,
  setupToolHarness,
} from "../tool-test-utils.js";

describe("list_gpg_keys", () => {
  const h = setupToolHarness({
    register: registerGpgKeyTools,
    defaultProject: "D",
  });

  test("returns keys", async () => {
    mockJson(h.mockClients.gpg.get, {
      values: [{ id: 1 }],
      size: 1,
      isLastPage: true,
    });
    const p = await callAndParse<{ total: number }>(
      h.client,
      "list_gpg_keys",
      {},
    );
    expect(p.total).toBe(1);
  });

  test("API error", async () => {
    h.mockClients.gpg.get.mockRejectedValueOnce(new Error("fail"));
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

  test("delete key", async () => {
    mockJson(h.mockClients.gpg.delete, {});
    const p = await callAndParse<{ deleted: boolean }>(
      h.client,
      "manage_gpg_keys",
      { action: "delete", keyId: 1 },
    );
    expect(p.deleted).toBe(true);
  });

  test("add error", async () => {
    h.mockClients.gpg.post.mockRejectedValueOnce(new Error("fail"));
    const r = await callRaw(h.client, "manage_gpg_keys", {
      action: "add",
      text: "bad",
    });
    expect(r.isError).toBe(true);
  });
});
