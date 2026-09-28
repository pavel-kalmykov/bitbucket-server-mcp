import { expect } from "vitest";
import { callAndParse } from "../../fixtures/tool-test-utils.js";
import { test, describeBitbucket } from ".././e2e-suite.js";

describeBitbucket("GPG keys", () => {
  test("list_gpg_keys returns data", async ({ mcp }) => {
    const r = await callAndParse<{ total: number; keys: unknown[] }>(
      mcp.client,
      "list_gpg_keys",
      {},
    );
    expect(typeof r.total).toBe("number");
    expect(Array.isArray(r.keys)).toBe(true);
  });

  test("list_gpg_keys curates the response", async ({ mcp }) => {
    const r = await callAndParse<{ keys: Array<Record<string, unknown>> }>(
      mcp.client,
      "list_gpg_keys",
      { fields: "id" },
    );
    for (const key of r.keys) {
      expect(Object.keys(key)).toEqual(["id"]);
    }
  });
});
