import type { ApiContext } from "./context.js";
import { resolveProject } from "./context.js";

export interface SearchParams {
  query: string;
  project?: string;
  repository?: string;
  limit?: number;
  start?: number;
}

export interface SearchResult {
  values: Record<string, unknown>[];
  isLastPage: boolean;
  count?: number;
  nextStart?: number;
}

/**
 * Bitbucket's search endpoint takes no scope parameters, so the scope travels
 * inside the query string itself.
 */
function scopeQuery(
  ctx: ApiContext,
  { query, project, repository }: SearchParams,
): string {
  if (repository) {
    return `repo:${resolveProject(ctx, project)}/${repository} ${query}`;
  }
  return project ? `project:${project} ${query}` : query;
}

export function searchApi(ctx: ApiContext) {
  async function run(
    query: string,
    { limit = 25, start = 0 }: SearchParams,
  ): Promise<SearchResult> {
    const data = await ctx.http.search
      .post("search", {
        json: { query, entities: { code: { start, limit } } },
      })
      .json<{ code: SearchResult }>();

    return data.code;
  }

  return {
    /** Search file contents. */
    async code(params: SearchParams): Promise<SearchResult> {
      return run(scopeQuery(ctx, params), params);
    },

    /**
     * Search file names. Bitbucket has no separate endpoint for this: quoting
     * the whole query is what turns a content search into a filename search.
     */
    async files(params: SearchParams): Promise<SearchResult> {
      return run(`"${scopeQuery(ctx, params)}"`, params);
    },
  };
}

export type SearchApi = ReturnType<typeof searchApi>;
