import { describe, test, expect, beforeAll, afterAll } from "vitest";
import { SELECTED_VERSIONS } from "./versions.js";
import {
  startBitbucket,
  type StartedBitbucket,
} from "./bitbucket-container.js";
import { setupMcpAgainst, type McpAgainstBitbucket } from "./mcp-harness.js";

describe.each(SELECTED_VERSIONS)("system: Bitbucket $name", (version) => {
  let bb: StartedBitbucket;
  let mcp: McpAgainstBitbucket;

  beforeAll(async () => {
    bb = await startBitbucket(version);
    mcp = await setupMcpAgainst(bb);
  }, 420_000);

  afterAll(async () => {
    await mcp?.close();
    await bb?.stop();
  });

  test("get_server_info returns version", async () => {
    const result = await mcp.client.callTool({
      name: "get_server_info",
      arguments: {},
    });
    const content = result.content as Array<{ type: string; text: string }>;
    const parsed = JSON.parse(content[0].text) as {
      version: string;
      buildNumber: string;
    };

    expect(parsed.version).toBeDefined();
    expect(parsed.buildNumber).toBeDefined();
  });
});
