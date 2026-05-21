import { describe, test, expect } from "vitest";
import { registerDeploymentTools } from "../../tools/deployments.js";
import { mockJson, mockVoid } from "../test-utils.js";
import {
  callAndParse,
  callRaw,
  expectCalledWithJson,
  expectCalledWithSearchParams,
  setupToolHarness,
} from "../tool-test-utils.js";

const BASE_URL = "projects/TEST/repos/my-repo/commits/abc123/deployments";

const GET_REQUIRED_PARAMS = {
  project: "TEST",
  repository: "my-repo",
  commitId: "abc123",
  key: "deploy-1",
  environmentKey: "prod",
  deploymentSequenceNumber: 1,
} as const;

const CREATE_REQUIRED_PARAMS = {
  project: "TEST",
  repository: "my-repo",
  commitId: "abc123",
  deploymentSequenceNumber: 1,
  description: "Deploy to prod",
  displayName: "Prod Deploy",
  key: "deploy-1",
  environmentKey: "prod",
  environmentDisplayName: "Production",
  state: "SUCCESSFUL",
} as const;

describe("manage_deployments", () => {
  const h = setupToolHarness({
    register: registerDeploymentTools,
    defaultProject: "DEFAULT",
  });

  describe("get", () => {
    test("returns deployment from API with correct searchParams", async () => {
      mockJson(h.mockClients.api.get, {
        key: "deploy-1",
        state: "SUCCESSFUL",
      });

      const parsed = await callAndParse<{
        key: string;
        state: string;
      }>(h.client, "manage_deployments", {
        action: "get",
        ...GET_REQUIRED_PARAMS,
      });

      expect(parsed.key).toBe("deploy-1");
      expect(parsed.state).toBe("SUCCESSFUL");
      expectCalledWithSearchParams(h.mockClients.api.get, BASE_URL, {
        key: "deploy-1",
        environmentKey: "prod",
        deploymentSequenceNumber: "1",
      });
    });

    test.each([
      ["key", { ...GET_REQUIRED_PARAMS, key: undefined }],
      ["environmentKey", { ...GET_REQUIRED_PARAMS, environmentKey: undefined }],
      [
        "deploymentSequenceNumber",
        { ...GET_REQUIRED_PARAMS, deploymentSequenceNumber: undefined },
      ],
    ] as const)("returns error when %s is missing", async (_, args) => {
      const result = await callRaw(h.client, "manage_deployments", {
        action: "get",
        ...args,
      });
      expect(result.isError).toBe(true);
    });

    test("returns error when API call fails", async () => {
      h.mockClients.api.get.mockRejectedValueOnce(new Error("Not found"));

      const result = await callRaw(h.client, "manage_deployments", {
        action: "get",
        ...GET_REQUIRED_PARAMS,
      });
      expect(result.isError).toBe(true);
    });
  });

  describe("delete", () => {
    test("returns deleted confirmation with correct searchParams", async () => {
      mockVoid(h.mockClients.api.delete);

      const parsed = await callAndParse<{
        deleted: boolean;
        key: string;
        environmentKey: string;
        deploymentSequenceNumber: number;
      }>(h.client, "manage_deployments", {
        action: "delete",
        ...GET_REQUIRED_PARAMS,
      });

      expect(parsed.deleted).toBe(true);
      expect(parsed.key).toBe("deploy-1");
      expect(parsed.environmentKey).toBe("prod");
      expect(parsed.deploymentSequenceNumber).toBe(1);
      expectCalledWithSearchParams(h.mockClients.api.delete, BASE_URL, {
        key: "deploy-1",
        environmentKey: "prod",
        deploymentSequenceNumber: "1",
      });
    });

    test("returns error when key is missing", async () => {
      const result = await callRaw(h.client, "manage_deployments", {
        action: "delete",
        ...GET_REQUIRED_PARAMS,
        key: undefined,
      });
      expect(result.isError).toBe(true);
    });

    test("returns error when API call fails", async () => {
      h.mockClients.api.delete.mockRejectedValueOnce(new Error("Forbidden"));

      const result = await callRaw(h.client, "manage_deployments", {
        action: "delete",
        ...GET_REQUIRED_PARAMS,
      });
      expect(result.isError).toBe(true);
    });
  });

  describe("create", () => {
    test("sends required fields in JSON body without optionals", async () => {
      mockJson(h.mockClients.api.post, {
        key: "deploy-1",
        state: "SUCCESSFUL",
      });

      const parsed = await callAndParse<{
        key: string;
        state: string;
      }>(h.client, "manage_deployments", {
        action: "create",
        ...CREATE_REQUIRED_PARAMS,
      });

      expect(parsed.key).toBe("deploy-1");
      expectCalledWithJson(h.mockClients.api.post, BASE_URL, {
        deploymentSequenceNumber: 1,
        description: "Deploy to prod",
        displayName: "Prod Deploy",
        key: "deploy-1",
        state: "SUCCESSFUL",
        environment: {
          displayName: "Production",
          key: "prod",
        },
      });
    });

    test("includes environmentType when provided", async () => {
      mockJson(h.mockClients.api.post, { key: "deploy-1" });

      await callAndParse(h.client, "manage_deployments", {
        action: "create",
        ...CREATE_REQUIRED_PARAMS,
        environmentType: "PRODUCTION",
      });

      expectCalledWithJson(h.mockClients.api.post, BASE_URL, {
        environment: {
          displayName: "Production",
          key: "prod",
          type: "PRODUCTION",
        },
      });
    });

    test("includes url when provided", async () => {
      mockJson(h.mockClients.api.post, { key: "deploy-1" });

      await callAndParse(h.client, "manage_deployments", {
        action: "create",
        ...CREATE_REQUIRED_PARAMS,
        url: "https://example.com/deploy/1",
      });

      expectCalledWithJson(h.mockClients.api.post, BASE_URL, {
        url: "https://example.com/deploy/1",
      });
    });

    test("includes both environmentType and url when provided", async () => {
      mockJson(h.mockClients.api.post, { key: "deploy-1" });

      await callAndParse(h.client, "manage_deployments", {
        action: "create",
        ...CREATE_REQUIRED_PARAMS,
        environmentType: "STAGING",
        url: "https://example.com/deploy/1",
      });

      expectCalledWithJson(h.mockClients.api.post, BASE_URL, {
        environment: {
          displayName: "Production",
          key: "prod",
          type: "STAGING",
        },
        url: "https://example.com/deploy/1",
      });
    });

    test.each([
      ["description", { ...CREATE_REQUIRED_PARAMS, description: undefined }],
      ["displayName", { ...CREATE_REQUIRED_PARAMS, displayName: undefined }],
      ["state", { ...CREATE_REQUIRED_PARAMS, state: undefined }],
      [
        "environmentDisplayName",
        { ...CREATE_REQUIRED_PARAMS, environmentDisplayName: undefined },
      ],
    ] as const)("returns error when %s is missing", async (_, args) => {
      const result = await callRaw(h.client, "manage_deployments", {
        action: "create",
        ...args,
      });
      expect(result.isError).toBe(true);
    });

    test("returns error when API call fails", async () => {
      h.mockClients.api.post.mockRejectedValueOnce(new Error("Conflict"));

      const result = await callRaw(h.client, "manage_deployments", {
        action: "create",
        ...CREATE_REQUIRED_PARAMS,
      });
      expect(result.isError).toBe(true);
    });
  });

  test("uses default project when not provided", async () => {
    mockJson(h.mockClients.api.get, { key: "deploy-1" });

    await callAndParse(h.client, "manage_deployments", {
      action: "get",
      repository: "my-repo",
      commitId: "abc123",
      key: "deploy-1",
      environmentKey: "prod",
      deploymentSequenceNumber: 1,
    });

    expect(h.mockClients.api.get).toHaveBeenCalledWith(
      "projects/DEFAULT/repos/my-repo/commits/abc123/deployments",
      expect.anything(),
    );
  });

  test("uses explicit project when provided", async () => {
    mockJson(h.mockClients.api.get, { key: "deploy-1" });

    await callAndParse(h.client, "manage_deployments", {
      action: "get",
      ...GET_REQUIRED_PARAMS,
    });

    expect(h.mockClients.api.get).toHaveBeenCalledWith(
      BASE_URL,
      expect.anything(),
    );
  });
});
