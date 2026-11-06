import type { ApiContext } from "./context.js";
import { resolveProject } from "./context.js";

export interface SetWatchingParams {
  project?: string;
  repository: string;
}

export interface WatchersApi {
  watch(params: SetWatchingParams): Promise<void>;
  unwatch(params: SetWatchingParams): Promise<void>;
}

// Bitbucket has no GET-able watchers resource: the subscription is only
// reachable as POST/DELETE on the repo's watch resource, and it always
// targets the authenticated user (no name parameter exists).
export function watchersApi(ctx: ApiContext): WatchersApi {
  const watchPath = (project?: string, repository?: string) =>
    `projects/${resolveProject(ctx, project)}/repos/${repository}/watch`;

  return {
    async watch(params) {
      await ctx.http.api.post(watchPath(params.project, params.repository));
    },

    async unwatch(params) {
      await ctx.http.api.delete(watchPath(params.project, params.repository));
    },
  };
}
