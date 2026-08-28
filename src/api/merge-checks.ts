import type { ApiContext } from "./context.js";
import { resolveProject } from "./context.js";

const MERGE_CHECK_HOOK_TYPE = "PRE_PULL_REQUEST_MERGE";

interface RepositoryHook {
  key: string;
  enabled: boolean;
  details?: { name?: string; description?: string; type?: string };
}

export interface ListMergeChecksParams {
  project?: string;
  repository: string;
}

export interface ConfigureMergeCheckParams {
  project?: string;
  repository: string;
  hookKey: string;
  settings: Record<string, unknown>;
}

export interface MergeCheck {
  key: string;
  name?: string;
  description?: string;
  enabled: boolean;
  settings: Record<string, unknown>;
}

export function mergeChecksApi(ctx: ApiContext) {
  return {
    async list({
      project,
      repository,
    }: ListMergeChecksParams): Promise<MergeCheck[]> {
      const resolved = resolveProject(ctx, project);
      const hooks = await ctx.http.api
        .get(`projects/${resolved}/repos/${repository}/settings/hooks`)
        .json<{ values: RepositoryHook[] }>();

      const mergeCheckHooks = hooks.values.filter(
        (hook) => hook.details?.type === MERGE_CHECK_HOOK_TYPE,
      );

      return Promise.all(
        mergeCheckHooks.map(async (hook) => ({
          key: hook.key,
          name: hook.details?.name,
          description: hook.details?.description,
          enabled: hook.enabled,
          settings: await ctx.http.api
            .get(
              `projects/${resolved}/repos/${repository}/settings/hooks/${hook.key}/settings`,
            )
            .json<Record<string, unknown>>()
            .catch(() => ({})),
        })),
      );
    },

    async configure({
      project,
      repository,
      hookKey,
      settings,
    }: ConfigureMergeCheckParams): Promise<unknown> {
      return ctx.http.api
        .put(
          `projects/${resolveProject(ctx, project)}/repos/${repository}/settings/hooks/${hookKey}/settings`,
          { json: settings },
        )
        .json();
    },
  };
}

export type MergeChecksApi = ReturnType<typeof mergeChecksApi>;
