import type { ApiContext } from "./context.js";
import { resolveProject } from "./context.js";

export interface GetBuildStatusParams {
  project?: string;
  repository?: string;
  prId?: number;
  commitId?: string;
}

export function buildStatusApi(ctx: ApiContext) {
  return {
    /**
     * Accepts either a commit hash or a pull request id; with a pull request
     * it reports on the source branch's latest commit.
     */
    async get({
      project,
      repository,
      prId,
      commitId,
    }: GetBuildStatusParams): Promise<unknown[]> {
      let resolvedCommit = commitId;

      if (prId) {
        if (!repository) {
          throw new Error("repository is required when using prId.");
        }
        const pr = await ctx.http.api
          .get(
            `projects/${resolveProject(ctx, project)}/repos/${repository}/pull-requests/${prId}`,
          )
          .json<{ fromRef: { latestCommit: string } }>();
        resolvedCommit = pr.fromRef.latestCommit;
      }

      if (!resolvedCommit) {
        throw new Error("Either commitId or prId is required.");
      }

      const data = await ctx.http.buildStatus
        .get(`commits/${resolvedCommit}`)
        .json<{ values: unknown[] }>();

      return data.values;
    },
  };
}

export type BuildStatusApi = ReturnType<typeof buildStatusApi>;
