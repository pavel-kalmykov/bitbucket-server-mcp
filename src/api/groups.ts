import type { ApiContext } from "./context.js";

interface ListGroupsParams {
  filter?: string;
  limit?: number;
  start?: number;
}

interface GroupPage {
  /** Group names, projected from the endpoint's group objects. */
  values: string[];
  size: number;
  limit: number;
  isLastPage: boolean;
  start?: number;
}

interface RawGroupPage {
  values: Array<Record<string, unknown>>;
  size: number;
  limit: number;
  isLastPage: boolean;
  start?: number;
}

export interface GroupsApi {
  /**
   * Global group names. Requires the admin permission to see groups the
   * caller does not belong to.
   */
  list(params: ListGroupsParams): Promise<GroupPage>;
}

export function groupsApi(ctx: ApiContext): GroupsApi {
  return {
    async list({ filter, limit = 25, start = 0 }: ListGroupsParams) {
      const searchParams: Record<string, string | number> = { limit, start };
      if (filter) searchParams.filter = filter;
      // The swagger declares values as string[], but the live endpoint
      // returns objects ({ name, deletable }); project to names.
      const page = await ctx.http.api
        .get("admin/groups", { searchParams })
        .json<RawGroupPage>();
      return {
        ...page,
        values: page.values.map((group) =>
          typeof group === "string" ? group : String(group.name),
        ),
      };
    },
  };
}
