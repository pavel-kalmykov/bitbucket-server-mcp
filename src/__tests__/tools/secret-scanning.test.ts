import { describe, test, expect } from "vitest";
import { registerSecretScanningTools } from "../../tools/secret-scanning.js";
import { mockJson } from "../test-utils.js";
import { callAndParse, callRaw, setupToolHarness } from "../tool-test-utils.js";

describe("list_secret_scanning_rules", () => {
  const h = setupToolHarness({
    register: registerSecretScanningTools,
    defaultProject: "D",
  });

  test("returns rules", async () => {
    mockJson(h.mockClients.api.get, { values: [{ id: 1 }] });
    const p = await callAndParse<Array<{ id: number }>>(
      h.client,
      "list_secret_scanning_rules",
      { project: "P", repository: "r" },
    );
    expect(p[0].id).toBe(1);
  });

  test("returns empty", async () => {
    mockJson(h.mockClients.api.get, { values: [] });
    const p = await callAndParse<unknown[]>(
      h.client,
      "list_secret_scanning_rules",
      { project: "P", repository: "r" },
    );
    expect(p).toHaveLength(0);
  });

  test("API error", async () => {
    h.mockClients.api.get.mockRejectedValueOnce(new Error("fail"));
    const r = await callRaw(h.client, "list_secret_scanning_rules", {
      project: "P",
      repository: "r",
    });
    expect(r.isError).toBe(true);
  });
});
