import { z } from "zod";
import { formatResponse, type ToolSuccessResult } from "../response/format.js";
import { toolAnnotations } from "../response/annotations.js";
import type { ToolContext } from "./shared.js";
import { projectParam, repositoryParam } from "./params.js";
import {
  curateResponse,
  DEFAULT_DEPLOYMENT_FIELDS,
} from "../response/curate.js";

const actionParam = z
  .enum(["get", "create", "delete"])
  .describe("Operation to perform.");
type DeploymentAction = z.infer<typeof actionParam>;

const IDENTITY_PARAMS = [
  "key",
  "environmentKey",
  "deploymentSequenceNumber",
] as const;

const CREATE_PARAMS = [
  "deploymentSequenceNumber",
  "description",
  "displayName",
  "key",
  "environmentKey",
  "environmentDisplayName",
  "state",
] as const;

function requireParams(
  params: Record<string, unknown>,
  names: readonly string[],
  action: string,
) {
  const missing = names.filter((n) => params[n] == null || params[n] === "");
  if (missing.length > 0) {
    throw new Error(`${missing.join(", ")} are required for ${action}.`);
  }
}

export function registerDeploymentTools(ctx: ToolContext) {
  const { server, bb } = ctx;

  server.registerTool(
    "manage_deployments",
    {
      description:
        'Manage deployments for a commit. Actions: "get" (retrieve a deployment), "create" (record a new deployment), "delete" (remove a deployment). ' +
        "GET requires key, environmentKey, and deploymentSequenceNumber. " +
        "POST body requires deploymentSequenceNumber, description, displayName, environment (with displayName, key, optional type), key, state, and optional url. " +
        "DELETE requires key, environmentKey, and deploymentSequenceNumber.",

      inputSchema: {
        action: actionParam,
        project: projectParam(),
        repository: repositoryParam(),
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
    async ({ action, ...params }) => {
      const identity = () => ({
        project: params.project,
        repository: params.repository,
        commitId: params.commitId,
        key: params.key!,
        environmentKey: params.environmentKey!,
        deploymentSequenceNumber: params.deploymentSequenceNumber!,
      });

      const run: Record<DeploymentAction, () => Promise<ToolSuccessResult>> = {
        get: async () => {
          requireParams(params, IDENTITY_PARAMS, "get");
          return formatResponse(
            curateResponse(
              await bb.deployments.get(identity()),
              DEFAULT_DEPLOYMENT_FIELDS,
            ),
          );
        },
        create: async () => {
          requireParams(params, CREATE_PARAMS, "create");
          return formatResponse(
            curateResponse(
              await bb.deployments.create({
                ...identity(),
                description: params.description!,
                displayName: params.displayName!,
                environmentDisplayName: params.environmentDisplayName!,
                environmentType: params.environmentType,
                state: params.state!,
                url: params.url,
              }),
              DEFAULT_DEPLOYMENT_FIELDS,
            ),
          );
        },
        delete: async () => {
          requireParams(params, IDENTITY_PARAMS, "delete");
          return formatResponse(await bb.deployments.delete(identity()));
        },
      };

      return run[action]();
    },
  );
}
