import { describe, test, expect } from "vitest";
import { registerSecretScanningTools } from "../../../tools/secret-scanning.js";
import { mockJson, mockReject } from "../../fixtures/test-utils.js";
import {
  callAndParse,
  callRaw,
  expectCalledWithJson,
  setupToolHarness,
} from "../../fixtures/tool-test-utils.js";

describe("manage_secret_scanning", () => {
  const h = setupToolHarness({
    register: registerSecretScanningTools,
    defaultProject: "D",
  });

  test("create posts name and lineRegex, curated", async () => {
    mockJson(h.mockClients.api.post, {
      id: 11,
      name: "probe rule",
      lineRegex: "PROBE-[a-z]+",
      scope: { type: "REPOSITORY", resourceId: 1 },
    });
    const parsed = await callAndParse<Record<string, unknown>>(
      h.client,
      "manage_secret_scanning",
      {
        action: "create",
        repository: "r",
        name: "probe rule",
        lineRegex: "PROBE-[a-z]+",
      },
    );
    expect(parsed).toEqual({
      id: 11,
      name: "probe rule",
      lineRegex: "PROBE-[a-z]+",
    });
    expectCalledWithJson(
      h.mockClients.api.post,
      "projects/D/repos/r/secret-scanning/allowlist",
      { name: "probe rule", lineRegex: "PROBE-[a-z]+" },
    );
  });

  test("create with pathRegex sends the full body", async () => {
    mockJson(h.mockClients.api.post, { id: 11 });
    await callAndParse(h.client, "manage_secret_scanning", {
      action: "create",
      repository: "r",
      name: "probe rule",
      lineRegex: "PROBE-[a-z]+",
      pathRegex: "*.pem",
    });
    expectCalledWithJson(
      h.mockClients.api.post,
      "projects/D/repos/r/secret-scanning/allowlist",
      {
        name: "probe rule",
        lineRegex: "PROBE-[a-z]+",
        pathRegex: "*.pem",
      },
    );
  });

  test("create without name fails", async () => {
    const result = await callRaw(h.client, "manage_secret_scanning", {
      action: "create",
      repository: "r",
      lineRegex: "PROBE-[a-z]+",
    });
    expect(result.isError).toBe(true);
    expect(result.content[0].text).toContain("name is required");
  });

  test("create without lineRegex fails", async () => {
    const result = await callRaw(h.client, "manage_secret_scanning", {
      action: "create",
      repository: "r",
      name: "probe rule",
    });
    expect(result.isError).toBe(true);
    expect(result.content[0].text).toContain("lineRegex is required");
  });

  test("update puts the changed fields on the rule id", async () => {
    mockJson(h.mockClients.api.put, {
      id: 7,
      name: "probe rule",
      lineRegex: "PROBE-[a-z]+",
      pathRegex: "*.jks",
    });
    const parsed = await callAndParse<Record<string, unknown>>(
      h.client,
      "manage_secret_scanning",
      {
        action: "update",
        repository: "r",
        ruleId: 7,
        name: "probe rule",
        pathRegex: "*.jks",
      },
    );
    expect(parsed.pathRegex).toBe("*.jks");
    expectCalledWithJson(
      h.mockClients.api.put,
      "projects/D/repos/r/secret-scanning/allowlist/7",
      { name: "probe rule", pathRegex: "*.jks" },
    );
  });

  test("update without ruleId fails", async () => {
    const result = await callRaw(h.client, "manage_secret_scanning", {
      action: "update",
      repository: "r",
      name: "probe rule",
    });
    expect(result.isError).toBe(true);
    expect(result.content[0].text).toContain("ruleId is required");
  });

  test("update without name fails", async () => {
    const result = await callRaw(h.client, "manage_secret_scanning", {
      action: "update",
      repository: "r",
      ruleId: 7,
    });
    expect(result.isError).toBe(true);
    expect(result.content[0].text).toContain("name is required");
  });

  test("delete removes the rule and echoes the id", async () => {
    mockJson(h.mockClients.api.delete, {});
    const parsed = await callAndParse<{ deleted: boolean; ruleId: number }>(
      h.client,
      "manage_secret_scanning",
      { action: "delete", repository: "r", ruleId: 7 },
    );
    expect(parsed.deleted).toBe(true);
    expect(parsed.ruleId).toBe(7);
    expect(h.mockClients.api.delete).toHaveBeenCalledWith(
      "projects/D/repos/r/secret-scanning/allowlist/7",
    );
  });

  test("delete without ruleId fails", async () => {
    const result = await callRaw(h.client, "manage_secret_scanning", {
      action: "delete",
      repository: "r",
    });
    expect(result.isError).toBe(true);
    expect(result.content[0].text).toContain("ruleId is required");
  });

  test("returns error on API failure", async () => {
    mockReject(h.mockClients.api.post, new Error("fail"));
    const result = await callRaw(h.client, "manage_secret_scanning", {
      action: "create",
      repository: "r",
      name: "probe rule",
      lineRegex: "PROBE-[a-z]+",
    });
    expect(result.isError).toBe(true);
  });

  test("fields param narrows the created rule", async () => {
    mockJson(h.mockClients.api.post, {
      id: 11,
      name: "probe rule",
      lineRegex: "PROBE-[a-z]+",
    });
    const parsed = await callAndParse<Record<string, unknown>>(
      h.client,
      "manage_secret_scanning",
      {
        action: "create",
        repository: "r",
        name: "probe rule",
        lineRegex: "PROBE-[a-z]+",
        fields: "id",
      },
    );
    expect(parsed).toEqual({ id: 11 });
  });

  test("fields '*all' returns the raw response", async () => {
    mockJson(h.mockClients.api.post, {
      id: 11,
      scope: { type: "REPOSITORY", resourceId: 1 },
    });
    const parsed = await callAndParse<{ scope: unknown }>(
      h.client,
      "manage_secret_scanning",
      {
        action: "create",
        repository: "r",
        name: "probe rule",
        lineRegex: "PROBE-[a-z]+",
        fields: "*all",
      },
    );
    expect(parsed.scope).toEqual({ type: "REPOSITORY", resourceId: 1 });
  });
});
