import { describe, test, expect, beforeAll, afterAll } from "vitest";
import { VERSIONS_WITH_LABELS, VERSIONS_WITHOUT_LABELS } from "./versions.js";
import {
  startBitbucket,
  type StartedBitbucket,
} from "./bitbucket-container.js";
import { bootstrap, type Scenario } from "./bootstrap.js";
import { setupMcpAgainst, type McpAgainstBitbucket } from "./mcp-harness.js";
import { callAndParse } from "../tool-test-utils.js";

interface LabelsResponse {
  total: number;
  labels: Array<{ name: string }>;
}

describe.each(VERSIONS_WITH_LABELS)(
  "labels supported: Bitbucket $name",
  (version) => {
    let bb: StartedBitbucket;
    let mcp: McpAgainstBitbucket;
    let scenario: Scenario;

    beforeAll(async () => {
      bb = await startBitbucket(version);
      scenario = await bootstrap(bb.api);
      mcp = await setupMcpAgainst(bb);
    }, 420_000);

    afterAll(async () => {
      await mcp?.close();
      await bb?.stop();
    });

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

    test("manage_labels can add and remove a label", async () => {
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
);

describe.each(VERSIONS_WITHOUT_LABELS)(
  "labels unsupported: Bitbucket $name",
  (version) => {
    let bb: StartedBitbucket;
    let mcp: McpAgainstBitbucket;
    let scenario: Scenario;

    beforeAll(async () => {
      bb = await startBitbucket(version);
      scenario = await bootstrap(bb.api);
      mcp = await setupMcpAgainst(bb);
    }, 420_000);

    afterAll(async () => {
      await mcp?.close();
      await bb?.stop();
    });

    test("list_labels does not crash on unsupported versions", async () => {
      await callAndParse(mcp.client, "list_labels", {
        project: scenario.projectKey,
        repository: scenario.repoSlug,
      });
    });
  },
);
