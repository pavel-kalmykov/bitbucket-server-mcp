import { describe, test, expect, beforeAll, afterAll } from "vitest";
import { SELECTED_VERSIONS } from "./versions.js";
import {
  startBitbucket,
  type StartedBitbucket,
} from "./bitbucket-container.js";
import { bootstrap, type Scenario } from "./bootstrap.js";
import { setupMcpAgainst, type McpAgainstBitbucket } from "./mcp-harness.js";
import { callAndParse, callRaw } from "../tool-test-utils.js";
import type { Deployment } from "../../generated/types.js";

describe.each(SELECTED_VERSIONS)("deployments: Bitbucket $name", (version) => {
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

  test("create deployment returns the deployment", async () => {
    const parsed = await callAndParse<Deployment>(
      mcp.client,
      "manage_deployments",
      {
        action: "create",
        project: scenario.projectKey,
        repository: scenario.repoSlug,
        commitId: scenario.mainCommitId,
        deploymentSequenceNumber: 1,
        description: "E2E deploy",
        displayName: "Deploy 1",
        key: "e2e-deploy-1",
        environmentKey: "e2e-env",
        environmentDisplayName: "E2E Env",
        environmentType: "TESTING",
        state: "IN_PROGRESS",
        url: "https://example.com/deploy/1",
      },
    );

    expect(parsed.key).toBe("e2e-deploy-1");
    expect(parsed.state).toBe("IN_PROGRESS");
    expect(parsed.deploymentSequenceNumber).toBe(1);
    expect(parsed.environment?.key).toBe("e2e-env");
    expect(parsed.environment?.displayName).toBe("E2E Env");
    expect(parsed.environment?.type).toBe("TESTING");
  });

  test("get deployment returns the created deployment", async () => {
    const parsed = await callAndParse<Deployment>(
      mcp.client,
      "manage_deployments",
      {
        action: "get",
        project: scenario.projectKey,
        repository: scenario.repoSlug,
        commitId: scenario.mainCommitId,
        key: "e2e-deploy-1",
        environmentKey: "e2e-env",
        deploymentSequenceNumber: 1,
      },
    );

    expect(parsed.key).toBe("e2e-deploy-1");
    expect(parsed.state).toBe("IN_PROGRESS");
  });

  test("delete deployment succeeds", async () => {
    const parsed = await callAndParse<{
      deleted: boolean;
      key: string;
    }>(mcp.client, "manage_deployments", {
      action: "delete",
      project: scenario.projectKey,
      repository: scenario.repoSlug,
      commitId: scenario.mainCommitId,
      key: "e2e-deploy-1",
      environmentKey: "e2e-env",
      deploymentSequenceNumber: 1,
    });

    expect(parsed.deleted).toBe(true);
    expect(parsed.key).toBe("e2e-deploy-1");
  });

  test("get after delete returns error", async () => {
    const result = await callRaw(mcp.client, "manage_deployments", {
      action: "get",
      project: scenario.projectKey,
      repository: scenario.repoSlug,
      commitId: scenario.mainCommitId,
      key: "e2e-deploy-1",
      environmentKey: "e2e-env",
      deploymentSequenceNumber: 1,
    });

    expect(result.isError).toBe(true);
  });

  test("create without required fields returns error", async () => {
    const result = await callRaw(mcp.client, "manage_deployments", {
      action: "create",
      project: scenario.projectKey,
      repository: scenario.repoSlug,
      commitId: scenario.mainCommitId,
    });

    expect(result.isError).toBe(true);
  });

  test("get without required params returns error", async () => {
    const result = await callRaw(mcp.client, "manage_deployments", {
      action: "get",
      project: scenario.projectKey,
      repository: scenario.repoSlug,
      commitId: scenario.mainCommitId,
    });

    expect(result.isError).toBe(true);
  });
});
