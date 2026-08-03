import { test, expect } from "vitest";
import { callRaw } from "../tool-test-utils.js";
import { describeBitbucket } from "./e2e-suite.js";

describeBitbucket("insights", ({ mcp, s }) => {
  test("get_build_status returns result for a commit", async () => {
    const result = await callRaw(mcp.client, "get_build_status", {
      commitId: s.mainCommitId,
    });

    expect(result.isError).toBeFalsy();
  });
});
