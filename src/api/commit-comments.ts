import type { ApiContext } from "./context.js";
import { resolveProject } from "./context.js";
import { getPaginated } from "./http/client.js";
import type { Paginated } from "./http/pagination.js";

export interface ListCommitCommentsParams {
  project?: string;
  repository: string;
  commitId: string;
  limit?: number;
  start?: number;
}

export interface CreateCommitCommentParams {
  project?: string;
  repository: string;
  commitId: string;
  text?: string;
}

export interface UpdateCommitCommentParams extends CreateCommitCommentParams {
  commentId?: number;
  version?: number;
}

export interface DeleteCommitCommentParams {
  project?: string;
  repository: string;
  commitId: string;
  commentId?: number;
  version?: number;
}

export function commitCommentsApi(ctx: ApiContext) {
  const path = (
    project: string | undefined,
    repository: string,
    commitId: string,
  ) =>
    `projects/${resolveProject(ctx, project)}/repos/${repository}/commits/${commitId}/comments`;

  return {
    async list({
      project,
      repository,
      commitId,
      limit = 25,
      start = 0,
    }: ListCommitCommentsParams): Promise<Paginated<Record<string, unknown>>> {
      return getPaginated(ctx.http.api, path(project, repository, commitId), {
        searchParams: { limit, start },
      });
    },

    async create({
      project,
      repository,
      commitId,
      text,
    }: CreateCommitCommentParams): Promise<Record<string, unknown>> {
      return ctx.http.api
        .post(path(project, repository, commitId), { json: { text } })
        .json<Record<string, unknown>>();
    },

    async update({
      project,
      repository,
      commitId,
      commentId,
      text,
      version,
    }: UpdateCommitCommentParams): Promise<Record<string, unknown>> {
      return ctx.http.api
        .put(`${path(project, repository, commitId)}/${commentId}`, {
          json: { text, version },
        })
        .json<Record<string, unknown>>();
    },

    async delete({
      project,
      repository,
      commitId,
      commentId,
      version,
    }: DeleteCommitCommentParams): Promise<{
      deleted: true;
      commentId?: number;
    }> {
      await ctx.http.api.delete(
        `${path(project, repository, commitId)}/${commentId}`,
        { searchParams: { version: version! } },
      );
      return { deleted: true, commentId };
    },
  };
}

export type CommitCommentsApi = ReturnType<typeof commitCommentsApi>;
