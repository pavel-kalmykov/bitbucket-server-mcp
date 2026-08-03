import { test, expect } from "vitest";
import { callRaw } from "../tool-test-utils.js";
import { describeBitbucket } from "./e2e-suite.js";

describeBitbucket("system", ({ mcp }) => {
  test("get_server_info returns version", async () => {
    const result = await callRaw(mcp.client, "get_server_info", {});
    const content = result.content;
    const parsed = JSON.parse(content[0].text) as {
      version: string;
      buildNumber: string;
    };

    expect(parsed.version).toBeDefined();
    expect(parsed.buildNumber).toBeDefined();
  });
});
