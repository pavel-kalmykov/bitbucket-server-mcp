import type { ApiContext } from "./context.js";

export interface UserSearchResult {
  values: Record<string, unknown>[];
  size: number;
  isLastPage: boolean;
}

export interface GetUserParams {
  userSlug: string;
}

export interface SearchUsersParams {
  filter: string;
  limit?: number;
  start?: number;
}

export function usersApi(ctx: ApiContext) {
  return {
    async get({ userSlug }: GetUserParams): Promise<Record<string, unknown>> {
      return ctx.http.api
        .get(`users/${userSlug}`)
        .json<Record<string, unknown>>();
    },

    async search({
      filter,
      limit = 25,
      start = 0,
    }: SearchUsersParams): Promise<UserSearchResult> {
      return ctx.http.api
        .get("users", { searchParams: { filter, limit, start } })
        .json<UserSearchResult>();
    },
  };
}

export type UsersApi = ReturnType<typeof usersApi>;
