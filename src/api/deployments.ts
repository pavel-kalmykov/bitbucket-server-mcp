import type { ApiContext } from "./context.js";
import { resolveProject } from "./context.js";
import type { Deployment } from "../generated/types.js";

interface DeploymentTarget {
  project?: string;
  repository: string;
  commitId: string;
}

export interface GetDeploymentParams extends DeploymentTarget {
  key: string;
  environmentKey: string;
  deploymentSequenceNumber: number;
}

export type DeleteDeploymentParams = GetDeploymentParams;

export interface CreateDeploymentParams extends DeploymentTarget {
  key: string;
  environmentKey: string;
  environmentDisplayName: string;
  environmentType?: string;
  deploymentSequenceNumber: number;
  description: string;
  displayName: string;
  state: string;
  url?: string;
}

export function deploymentsApi(ctx: ApiContext) {
  const path = ({ project, repository, commitId }: DeploymentTarget) =>
    `projects/${resolveProject(ctx, project)}/repos/${repository}/commits/${commitId}/deployments`;

  const identity = ({
    key,
    environmentKey,
    deploymentSequenceNumber,
  }: GetDeploymentParams) => ({
    key,
    environmentKey,
    deploymentSequenceNumber: String(deploymentSequenceNumber),
  });

  return {
    async get(params: GetDeploymentParams): Promise<Deployment> {
      return ctx.http.api
        .get(path(params), { searchParams: identity(params) })
        .json<Deployment>();
    },

    async create(params: CreateDeploymentParams): Promise<Deployment> {
      const environment: Record<string, unknown> = {
        displayName: params.environmentDisplayName,
        key: params.environmentKey,
      };
      if (params.environmentType) environment.type = params.environmentType;

      const json: Record<string, unknown> = {
        deploymentSequenceNumber: params.deploymentSequenceNumber,
        description: params.description,
        displayName: params.displayName,
        environment,
        key: params.key,
        state: params.state,
      };
      if (params.url) json.url = params.url;

      return ctx.http.api.post(path(params), { json }).json<Deployment>();
    },

    async delete(params: DeleteDeploymentParams): Promise<{
      deleted: true;
      key: string;
      environmentKey: string;
      deploymentSequenceNumber: number;
    }> {
      await ctx.http.api.delete(path(params), {
        searchParams: identity(params),
      });

      return {
        deleted: true,
        key: params.key,
        environmentKey: params.environmentKey,
        deploymentSequenceNumber: params.deploymentSequenceNumber,
      };
    },
  };
}

export type DeploymentsApi = ReturnType<typeof deploymentsApi>;
