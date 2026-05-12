import { describe, test, expect } from "vitest";
import { registerSshKeyTools } from "../../tools/ssh-keys.js";
import { mockJson } from "../test-utils.js";
import {
  callAndParse,
  callRaw,
  expectCalledWithJson,
  setupToolHarness,
} from "../tool-test-utils.js";

describe("list_ssh_keys", () => {
  const h = setupToolHarness({
    register: registerSshKeyTools,
    defaultProject: "D",
  });

  test("returns keys", async () => {
    mockJson(h.mockClients.ssh.get, {
      values: [{ id: 1, label: "k1" }],
      size: 1,
      isLastPage: true,
    });
    const p = await callAndParse<{ total: number }>(
      h.client,
      "list_ssh_keys",
      {},
    );
    expect(p.total).toBe(1);
  });

  test("returns empty list", async () => {
    mockJson(h.mockClients.ssh.get, { values: [], size: 0, isLastPage: true });
    const p = await callAndParse<{ total: number }>(
      h.client,
      "list_ssh_keys",
      {},
    );
    expect(p.total).toBe(0);
  });

  test("passes user filter", async () => {
    mockJson(h.mockClients.ssh.get, { values: [], size: 0, isLastPage: true });
    await callAndParse(h.client, "list_ssh_keys", { userSlug: "jdoe" });
    expect(h.mockClients.ssh.get).toHaveBeenCalledWith(
      "keys",
      expect.objectContaining({
        searchParams: expect.objectContaining({ user: "jdoe" }),
      }),
    );
  });

  test("API error", async () => {
    h.mockClients.ssh.get.mockRejectedValueOnce(new Error("fail"));
    const r = await callRaw(h.client, "list_ssh_keys", {});
    expect(r.isError).toBe(true);
  });
});

describe("manage_ssh_keys", () => {
  const h = setupToolHarness({
    register: registerSshKeyTools,
    defaultProject: "D",
  });

  test("add key", async () => {
    mockJson(h.mockClients.ssh.post, { id: 1, text: "ssh-rsa..." });
    const p = await callAndParse<{ id: number }>(h.client, "manage_ssh_keys", {
      action: "add",
      text: "ssh-rsa AAA...",
    });
    expect(p.id).toBe(1);
    expectCalledWithJson(h.mockClients.ssh.post, "keys", {
      text: "ssh-rsa AAA...",
    });
  });

  test("delete key", async () => {
    mockJson(h.mockClients.ssh.delete, {});
    const p = await callAndParse<{ deleted: boolean }>(
      h.client,
      "manage_ssh_keys",
      { action: "delete", keyId: 1 },
    );
    expect(p.deleted).toBe(true);
  });

  test("add error", async () => {
    h.mockClients.ssh.post.mockRejectedValueOnce(new Error("fail"));
    const r = await callRaw(h.client, "manage_ssh_keys", {
      action: "add",
      text: "bad",
    });
    expect(r.isError).toBe(true);
  });
});
