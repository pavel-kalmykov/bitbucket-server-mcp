import { test, expect } from "vitest";
import { VERSIONS_WITH_LABELS, VERSIONS_WITHOUT_LABELS } from "./versions.js";
import { callAndParse, callRaw } from "../tool-test-utils.js";
import { describeBitbucket } from "./e2e-suite.js";

interface LabelsResponse {
  total: number;
  labels: Array<{ name: string }>;
}

describeBitbucket(
  "labels supported",
  ({ mcp, s: scenario }) => {
    test("list_labels returns an empty list on a fresh repo", async () => {
      const parsed = await callAndParse<LabelsResponse>(
        mcp.client,
        "list_labels",
        {
          project: scenario.projectKey,
          repository: scenario.repoSlug,
        },
      );

      expect(parsed.total).toBe(0);
      expect(parsed.labels).toHaveLength(0);
    });

    test("manage_labels add and remove works", async () => {
      await callAndParse(mcp.client, "manage_labels", {
        action: "add",
        project: scenario.projectKey,
        repository: scenario.repoSlug,
        name: "e2e-test-label",
      });

      const afterAdd = await callAndParse<LabelsResponse>(
        mcp.client,
        "list_labels",
        {
          project: scenario.projectKey,
          repository: scenario.repoSlug,
        },
      );

      expect(afterAdd.total).toBe(1);
      expect(afterAdd.labels[0].name).toBe("e2e-test-label");

      await callAndParse(mcp.client, "manage_labels", {
        action: "remove",
        project: scenario.projectKey,
        repository: scenario.repoSlug,
        name: "e2e-test-label",
      });

      const afterRemove = await callAndParse<LabelsResponse>(
        mcp.client,
        "list_labels",
        {
          project: scenario.projectKey,
          repository: scenario.repoSlug,
        },
      );

      expect(afterRemove.total).toBe(0);
    });
  },
  VERSIONS_WITH_LABELS,
);

describeBitbucket(
  "labels unsupported",
  ({ mcp, s: scenario }) => {
    test("list_labels returns an error on unsupported versions", async () => {
      const result = await callRaw(mcp.client, "list_labels", {
        project: scenario.projectKey,
        repository: scenario.repoSlug,
      });

      expect(result.isError).toBe(true);
    });
  },
  VERSIONS_WITHOUT_LABELS,
);
