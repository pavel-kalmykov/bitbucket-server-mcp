import { expect } from "vitest";
import { callRaw } from "../tool-test-utils.js";
import { test, describeBitbucket } from "./e2e-suite.js";

describeBitbucket("system", () => {
  test("get_server_info returns version", async ({ mcp }) => {
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
