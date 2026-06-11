import { describe, test, expect } from "vitest";
import { registerDeploymentTools } from "../../tools/deployments.js";
import { mockJson, mockVoid, mockReject } from "../test-utils.js";
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
      mockReject(h.mockClients.api.get, new Error("Not found"));

      const result = await callRaw(h.client, "manage_deployments", {
        action: "get",
        ...GET_REQUIRED_PARAMS,
      });
      expect(result.isError).toBe(true);
    });

    test("requireParams rejects empty string", async () => {
      const result = await callRaw(h.client, "manage_deployments", {
        action: "get",
        ...GET_REQUIRED_PARAMS,
        key: "",
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
      mockReject(h.mockClients.api.delete, new Error("Forbidden"));

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

    test("create without environmentType omits it from body", async () => {
      mockJson(h.mockClients.api.post, { key: "deploy-1" });

      await callAndParse(h.client, "manage_deployments", {
        action: "create",
        ...CREATE_REQUIRED_PARAMS,
      });

      expectCalledWithJson(h.mockClients.api.post, BASE_URL, {
        environment: {
          displayName: "Production",
          key: "prod",
        },
      });

      const body = h.mockClients.api.post.mock.calls[0][1] as {
        json: Record<string, unknown>;
      };
      expect(
        (body.json.environment as Record<string, unknown>).type,
      ).toBeUndefined();
    });

    test("create without url omits it from body", async () => {
      mockJson(h.mockClients.api.post, { key: "deploy-1" });

      await callAndParse(h.client, "manage_deployments", {
        action: "create",
        ...CREATE_REQUIRED_PARAMS,
      });

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

      const body = h.mockClients.api.post.mock.calls[0][1] as {
        json: Record<string, unknown>;
      };
      expect(body.json).not.toHaveProperty("url");
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

    test("requireParams lists all missing fields in error", async () => {
      const result = await callRaw(h.client, "manage_deployments", {
        action: "create",
        project: "TEST",
        repository: "my-repo",
        commitId: "abc123",
      });

      expect(result.isError).toBe(true);
      const text = (result.content as Array<{ type: string; text: string }>)[0]
        .text;
      expect(text).toContain("deploymentSequenceNumber");
      expect(text).toContain("description");
      expect(text).toContain("displayName");
      expect(text).toContain("key");
      expect(text).toContain("environmentKey");
      expect(text).toContain("environmentDisplayName");
      expect(text).toContain("state");
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
      mockReject(h.mockClients.api.post, new Error("Conflict"));

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

  test("whitespace-only param is not treated as missing", async () => {
    mockJson(h.mockClients.api.get, { key: "deploy-1" });

    await callAndParse(h.client, "manage_deployments", {
      action: "get",
      project: "TEST",
      repository: "my-repo",
      commitId: "abc123",
      key: "  ",
      environmentKey: "prod",
      deploymentSequenceNumber: 1,
    });

    expect(h.mockClients.api.get).toHaveBeenCalledWith(
      BASE_URL,
      expect.anything(),
    );
  });

  test("tool description mentions GET, POST, and DELETE", async () => {
    const { tools } = await h.client.listTools();
    const tool = tools.find((t) => t.name === "manage_deployments");
    expect(tool?.description).toContain("GET requires");
    expect(tool?.description).toContain("POST body requires");
    expect(tool?.description).toContain("DELETE requires");
  });
});
