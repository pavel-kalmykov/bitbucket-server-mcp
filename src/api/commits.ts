import type { ApiContext } from "./context.js";
import { resolveProject } from "./context.js";
import { getPaginated } from "./http/client.js";
import type { Paginated } from "./http/pagination.js";
import type { Commit as BaseCommit } from "../generated/types.js";

// The API returns slug/displayName on author but the spec does not document them.
export type Commit = BaseCommit & {
  author?: { name?: string; slug?: string; displayName?: string };
};

export interface ListCommitsParams {
  project?: string;
  repository: string;
  branch?: string;
  author?: string;
  limit?: number;
  start?: number;
}

export interface GetCommitParams {
  project?: string;
  repository: string;
  commitId: string;
}

export interface CompareRefsParams {
  project?: string;
  repository: string;
  from?: string;
  to?: string;
  limit?: number;
  start?: number;
}

function matchesAuthor(commit: Commit, needle: string): boolean {
  const author = commit.author;
  return Boolean(
    author?.name?.toLowerCase().includes(needle) ||
    author?.slug?.toLowerCase().includes(needle) ||
    author?.displayName?.toLowerCase().includes(needle),
  );
}

export function commitsApi(ctx: ApiContext) {
  return {
    /**
     * `author` filters the fetched page in memory because Bitbucket has no
     * author query on this endpoint, so `size` reports the matches on that
     * page rather than the server-side total.
     */
    async list({
      project,
      repository,
      branch,
      author,
      limit = 25,
      start = 0,
    }: ListCommitsParams): Promise<Paginated<Commit>> {
      const searchParams: Record<string, string | number> = { limit, start };
      if (branch) searchParams.until = branch;

      const page = await getPaginated<Commit>(
        ctx.http.api,
        `projects/${resolveProject(ctx, project)}/repos/${repository}/commits`,
        { searchParams },
      );

      if (!author) return page;

      const needle = author.toLowerCase();
      const values = page.values.filter((commit) =>
        matchesAuthor(commit, needle),
      );
      return { ...page, values, size: values.length };
    },

    async get({
      project,
      repository,
      commitId,
    }: GetCommitParams): Promise<Record<string, unknown>> {
      return ctx.http.api
        .get(
          `projects/${resolveProject(ctx, project)}/repos/${repository}/commits/${commitId}`,
        )
        .json<Record<string, unknown>>();
    },

    async compare({
      project,
      repository,
      from,
      to,
      limit = 25,
      start = 0,
    }: CompareRefsParams): Promise<Paginated<Record<string, unknown>>> {
      const searchParams: Record<string, string | number> = { limit, start };
      if (from) searchParams.from = from;
      if (to) searchParams.to = to;

      return getPaginated(
        ctx.http.api,
        `projects/${resolveProject(ctx, project)}/repos/${repository}/compare/commits`,
        { searchParams },
      );
    },
  };
}

export type CommitsApi = ReturnType<typeof commitsApi>;
