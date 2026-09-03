import { expect } from "vitest";
import { callAndParse } from "../tool-test-utils.js";
import { test, describeBitbucket } from "./e2e-suite.js";

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
});
