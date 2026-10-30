import { expect } from "vitest";
import { callAndParse, callRaw } from "../../fixtures/tool-test-utils.js";
import { test, describeBitbucket } from ".././e2e-suite.js";

describeBitbucket("comment anchors", () => {
  test("a valid inline anchor is stored and surfaced", async ({
    mcp,
    scenario,
  }) => {
    const pr = await scenario.project.repo.pr;
    const parsed = await callAndParse<{
      id: number;
      anchor?: { path: string; line: number };
      warning?: string;
    }>(mcp.client, "manage_comment", {
      action: "create",
      project: scenario.project.key,
      repository: scenario.project.repo.slug,
      prId: pr.id,
      text: "e2e: anchored note",
      filePath: "CHANGE.md",
      line: 1,
      lineType: "ADDED",
    });

    expect(parsed.warning).toBeUndefined();
    expect(parsed.anchor?.path).toBe("CHANGE.md");
    expect(parsed.anchor?.line).toBe(1);
  });

  test("an anchor is stored verbatim even outside the diff", async ({
    mcp,
    scenario,
  }) => {
    const pr = await scenario.project.repo.pr;
    const parsed = await callAndParse<{
      id: number;
      anchor?: { path: string; line: number; lineType: string };
      warning?: string;
    }>(mcp.client, "manage_comment", {
      action: "create",
      project: scenario.project.key,
      repository: scenario.project.repo.slug,
      prId: pr.id,
      text: "e2e: out-of-diff note",
      filePath: "README.md",
      line: 1,
      lineType: "ADDED",
    });

    // The server stores the anchor verbatim (resolved hashes included)
    // without validating it against the PR diff.
    expect(parsed.id).toBeTypeOf("number");
    expect(parsed.anchor?.path).toBe("README.md");
    expect(parsed.anchor?.line).toBe(1);
    expect(parsed.warning).toBeUndefined();
  });

  test("the server rejects a syntactically invalid anchor", async ({
    mcp,
    scenario,
  }) => {
    const pr = await scenario.project.repo.pr;
    const result = await callRaw(mcp.client, "manage_comment", {
      action: "create",
      project: scenario.project.key,
      repository: scenario.project.repo.slug,
      prId: pr.id,
      text: "e2e: invalid anchor",
      filePath: "CHANGE.md",
      line: 0,
      lineType: "ADDED",
    });
    expect(result.isError).toBe(true);
    expect(result.content[0].text).toContain("not a valid line number");
  });
});
