import { test, expect } from "vitest";
import { callAndParse, callRaw } from "../tool-test-utils.js";
import { describeBitbucket } from "./e2e-suite.js";
import type { Deployment } from "../../generated/types.js";

describeBitbucket("deployments", ({ mcp, s: scenario }) => {
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
