import { describe, test, expect, beforeAll, afterAll } from "vitest";
import { SELECTED_VERSIONS } from "./versions.js";
import {
  startBitbucket,
  type StartedBitbucket,
} from "./bitbucket-container.js";
import { bootstrap, type Scenario } from "./bootstrap.js";
import { setupMcpAgainst, type McpAgainstBitbucket } from "./mcp-harness.js";
import { callAndParse } from "../tool-test-utils.js";

describe.each(SELECTED_VERSIONS)("comments: Bitbucket $name", (version) => {
  let bb: StartedBitbucket;
  let mcp: McpAgainstBitbucket;
  let s: Scenario;

  beforeAll(async () => {
    bb = await startBitbucket(version);
    s = await bootstrap(bb.api);
    mcp = await setupMcpAgainst(bb);
  }, 420_000);

  afterAll(async () => {
    await mcp?.close();
    await bb?.stop();
  });

  test("manage_comment create adds a comment", async () => {
    const parsed = await callAndParse<{
      id: number;
      text: string;
    }>(mcp.client, "manage_comment", {
      action: "create",
      project: s.projectKey,
      repository: s.repoSlug,
      prId: s.prId,
      text: "E2E smoke test comment",
    });

    expect(parsed.id).toBeDefined();
    expect(parsed.text).toBe("E2E smoke test comment");
  });

  test("search_emoticons returns results", async () => {
    const parsed = await callAndParse<Array<{ shortcut: string }>>(
      mcp.client,
      "search_emoticons",
      { query: "thumb" },
    );

    expect(parsed.length).toBeGreaterThan(0);
  });
});
