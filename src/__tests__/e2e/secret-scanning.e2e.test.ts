import { test, expect } from "vitest";
import { SELECTED_VERSIONS, gte } from "./versions.js";
import { callAndParse, callRaw } from "../tool-test-utils.js";
import { describeBitbucket } from "./e2e-suite.js";

const SECRET_SCANNING_SINCE = "8.5";

const VERSIONS_WITH_SECRET_SCANNING = SELECTED_VERSIONS.filter((v) =>
  gte(v, SECRET_SCANNING_SINCE),
);

const VERSIONS_WITHOUT_SECRET_SCANNING = SELECTED_VERSIONS.filter(
  (v) => !gte(v, SECRET_SCANNING_SINCE),
);

describeBitbucket(
  "secret-scanning supported",
  ({ mcp, s: scenario }) => {
    test("list_secret_scanning_rules returns rules", async () => {
      const parsed = await callAndParse<unknown[]>(
        mcp.client,
        "list_secret_scanning_rules",
        {
          project: scenario.projectKey,
          repository: scenario.repoSlug,
        },
      );

      expect(Array.isArray(parsed)).toBe(true);
    });
  },
  VERSIONS_WITH_SECRET_SCANNING,
);

describeBitbucket(
  "secret-scanning unsupported",
  ({ mcp, s: scenario }) => {
    test("list_secret_scanning_rules returns error", async () => {
      const result = await callRaw(mcp.client, "list_secret_scanning_rules", {
        project: scenario.projectKey,
        repository: scenario.repoSlug,
      });

      expect(result.isError).toBe(true);
    });
  },
  VERSIONS_WITHOUT_SECRET_SCANNING,
);
