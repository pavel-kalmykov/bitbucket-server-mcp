import { expect } from "vitest";
import { callAndParse } from "../../fixtures/tool-test-utils.js";
import { test, describeBitbucket } from ".././e2e-suite.js";

describeBitbucket("groups", () => {
  test("list_groups returns group names", async ({ mcp }) => {
    const r = await callAndParse<{ groups: string[]; total: number }>(
      mcp.client,
      "list_groups",
      {},
    );
    expect(Array.isArray(r.groups)).toBe(true);
    expect(r.groups.length).toBeGreaterThan(0);
  });

  test("list_groups filters by prefix", async ({ mcp }) => {
    const all = await callAndParse<{ groups: string[] }>(
      mcp.client,
      "list_groups",
      {},
    );
    const prefix = all.groups[0].slice(0, 3);
    const filtered = await callAndParse<{ groups: string[] }>(
      mcp.client,
      "list_groups",
      { filter: prefix },
    );
    for (const name of filtered.groups) {
      expect(name.startsWith(prefix)).toBe(true);
    }
  });
});
