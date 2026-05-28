import { z } from "zod";
import { formatResponse } from "../response/format.js";
import { toolAnnotations } from "../response/annotations.js";
import { handleToolError } from "../http/errors.js";
import type { ToolContext } from "./shared.js";
import type { ApiClients } from "../http/client.js";
import type { Deployment } from "../generated/types.js";

const deploymentPath = (project: string, repo: string, commit: string) =>
  `projects/${project}/repos/${repo}/commits/${commit}/deployments`;

function requireParams(
  params: Record<string, unknown>,
  names: string[],
  action: string,
) {
  const missing = names.filter((n) => params[n] == null || params[n] === "");
  if (missing.length > 0) {
    throw new Error(`${missing.join(", ")} are required for ${action}.`);
  }
}

interface DeploymentActionContext {
  clients: ApiClients;
  basePath: string;
  key?: string;
  environmentKey?: string;
  deploymentSequenceNumber?: number;
  description?: string;
  displayName?: string;
  environmentDisplayName?: string;
  environmentType?: string;
  state?: string;
  url?: string;
}

const deploymentActions: Record<
  string,
  (ctx: DeploymentActionContext) => Promise<ReturnType<typeof formatResponse>>
> = {
  get: async ({
    clients,
    basePath,
    key,
    environmentKey,
    deploymentSequenceNumber,
  }) => {
    requireParams(
      { key, environmentKey, deploymentSequenceNumber },
      ["key", "environmentKey", "deploymentSequenceNumber"],
      "get",
    );
    const data = await clients.api
      .get(basePath, {
        searchParams: {
          key: key!,
          environmentKey: environmentKey!,
          deploymentSequenceNumber: String(deploymentSequenceNumber!),
        },
      })
      .json<Deployment>();
    return formatResponse(data);
  },

  create: async ({
    clients,
    basePath,
    deploymentSequenceNumber,
    description,
    displayName,
    key,
    environmentKey,
    environmentDisplayName,
    environmentType,
    state,
    url,
  }) => {
    requireParams(
      {
        deploymentSequenceNumber,
        description,
        displayName,
        key,
        environmentKey,
        environmentDisplayName,
        state,
      },
      [
        "deploymentSequenceNumber",
        "description",
        "displayName",
        "key",
        "environmentKey",
        "environmentDisplayName",
        "state",
      ],
      "create",
    );

    const environment: Record<string, unknown> = {
      displayName: environmentDisplayName,
      key: environmentKey,
    };
    if (environmentType) {
      environment.type = environmentType;
    }

    const body: Record<string, unknown> = {
      deploymentSequenceNumber,
      description,
      displayName,
      environment,
      key,
      state,
    };
    if (url) {
      body.url = url;
    }

    const data = await clients.api
      .post(basePath, { json: body })
      .json<Deployment>();
    return formatResponse(data);
  },

  delete: async ({
    clients,
    basePath,
    key,
    environmentKey,
    deploymentSequenceNumber,
  }) => {
    requireParams(
      { key, environmentKey, deploymentSequenceNumber },
      ["key", "environmentKey", "deploymentSequenceNumber"],
      "delete",
    );
    await clients.api.delete(basePath, {
      searchParams: {
        key: key!,
        environmentKey: environmentKey!,
        deploymentSequenceNumber: String(deploymentSequenceNumber!),
      },
    });
    return formatResponse({
      deleted: true,
      key,
      environmentKey,
      deploymentSequenceNumber,
    });
  },
};

export function registerDeploymentTools(ctx: ToolContext) {
  const { server, clients } = ctx;

  server.registerTool(
    "manage_deployments",
    {
      description:
        'Manage deployments for a commit. Actions: "get" (retrieve a deployment), "create" (record a new deployment), "delete" (remove a deployment). ' +
        "GET requires key, environmentKey, and deploymentSequenceNumber. " +
        "POST body requires deploymentSequenceNumber, description, displayName, environment (with displayName, key, optional type), key, state, and optional url. " +
        "DELETE requires key, environmentKey, and deploymentSequenceNumber.",

      inputSchema: {
        action: z
          .enum(["get", "create", "delete"])
          .describe("Operation to perform."),
        project: z
          .string()
          .optional()
          .describe("Project key. Defaults to BITBUCKET_DEFAULT_PROJECT."),
        repository: z.string().describe("Repository slug."),
        commitId: z.string().describe("Full commit hash."),
        key: z
          .string()
          .optional()
          .describe(
            'Deployment key (required for get/delete). Example: "deploy-prod-1".',
          ),
        environmentKey: z
          .string()
          .optional()
          .describe(
            'Environment key (required for get/delete). Example: "prod".',
          ),
        deploymentSequenceNumber: z
          .number()
          .int()
          .optional()
          .describe(
            "Deployment sequence number (required for get/delete). Example: 1.",
          ),
        description: z
          .string()
          .optional()
          .describe("Deployment description (for create, max 255 chars)."),
        displayName: z
          .string()
          .optional()
          .describe("Deployment display name (for create, max 255 chars)."),
        environmentDisplayName: z
          .string()
          .optional()
          .describe(
            'Environment display name (for create). Example: "Production".',
          ),
        environmentType: z
          .enum(["DEVELOPMENT", "TESTING", "STAGING", "PRODUCTION"] as const)
          .optional()
          .describe("Environment type (for create)."),
        state: z
          .enum([
            "PENDING",
            "IN_PROGRESS",
            "CANCELLED",
            "FAILED",
            "ROLLED_BACK",
            "SUCCESSFUL",
            "UNKNOWN",
          ] as const)
          .optional()
          .describe("Deployment state (for create)."),
        url: z
          .string()
          .optional()
          .describe("Deployment URL (for create, max 1024 chars)."),
      },
      annotations: toolAnnotations({
        readOnlyHint: false,
        idempotentHint: false,
      }),
    },
    async ({ action, project, repository, commitId, ...rest }) => {
      try {
        const resolvedProject = ctx.resolveProject(project);
        const basePath = deploymentPath(resolvedProject, repository, commitId);
        const handler = deploymentActions[action];
        return handler({ clients, basePath, ...rest });
      } catch (error) {
        return handleToolError(error);
      }
    },
  );
}
