import type { ApiContext } from "./context.js";
import { resolveProject } from "./context.js";

export interface ListSecretScanningRulesParams {
  project?: string;
  repository: string;
}

export function secretScanningApi(ctx: ApiContext) {
  return {
    async list({
      project,
      repository,
    }: ListSecretScanningRulesParams): Promise<Record<string, unknown>[]> {
      const data = await ctx.http.api
        .get(
          `projects/${resolveProject(ctx, project)}/repos/${repository}/secret-scanning/allowlist`,
        )
        .json<{ values: Record<string, unknown>[] }>();

      return data.values;
    },
  };
}

export type SecretScanningApi = ReturnType<typeof secretScanningApi>;
