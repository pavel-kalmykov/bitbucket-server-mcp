import type { ApiContext } from "./context.js";
import { resolveProject } from "./context.js";
import type { RestSecretScanningAllowlistRule } from "../generated/types.js";

export interface ListSecretScanningRulesParams {
  project?: string;
  repository: string;
}

export interface CreateSecretScanningRuleParams {
  project?: string;
  repository: string;
  name: string;
  lineRegex: string;
  pathRegex?: string;
}

export interface UpdateSecretScanningRuleParams {
  project?: string;
  repository: string;
  ruleId: number;
  name: string;
  lineRegex?: string;
  pathRegex?: string;
}

export interface DeleteSecretScanningRuleParams {
  project?: string;
  repository: string;
  ruleId: number;
}

export function secretScanningApi(ctx: ApiContext) {
  return {
    async list({
      project,
      repository,
    }: ListSecretScanningRulesParams): Promise<
      RestSecretScanningAllowlistRule[]
    > {
      const data = await ctx.http.api
        .get(
          `projects/${resolveProject(ctx, project)}/repos/${repository}/secret-scanning/allowlist`,
        )
        .json<{ values?: RestSecretScanningAllowlistRule[] }>();

      return data.values ?? [];
    },

    async create({
      project,
      repository,
      name,
      lineRegex,
      pathRegex,
    }: CreateSecretScanningRuleParams): Promise<RestSecretScanningAllowlistRule> {
      return ctx.http.api
        .post(
          `projects/${resolveProject(ctx, project)}/repos/${repository}/secret-scanning/allowlist`,
          {
            json: {
              name,
              lineRegex,
              ...(pathRegex !== undefined && { pathRegex }),
            },
          },
        )
        .json<RestSecretScanningAllowlistRule>();
    },

    async update({
      project,
      repository,
      ruleId,
      name,
      lineRegex,
      pathRegex,
    }: UpdateSecretScanningRuleParams): Promise<RestSecretScanningAllowlistRule> {
      return ctx.http.api
        .put(
          `projects/${resolveProject(ctx, project)}/repos/${repository}/secret-scanning/allowlist/${ruleId}`,
          {
            json: {
              name,
              ...(lineRegex !== undefined && { lineRegex }),
              ...(pathRegex !== undefined && { pathRegex }),
            },
          },
        )
        .json<RestSecretScanningAllowlistRule>();
    },

    async delete({
      project,
      repository,
      ruleId,
    }: DeleteSecretScanningRuleParams): Promise<{
      deleted: true;
      ruleId: number;
    }> {
      await ctx.http.api.delete(
        `projects/${resolveProject(ctx, project)}/repos/${repository}/secret-scanning/allowlist/${ruleId}`,
      );
      // The API answers 204 with no body; the echo identifies the deletion.
      return { deleted: true, ruleId };
    },
  };
}

export type SecretScanningApi = ReturnType<typeof secretScanningApi>;
