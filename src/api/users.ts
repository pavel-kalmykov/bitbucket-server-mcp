import type { ApiClients } from "./http/client.js";

export interface UserSearchResult {
  values: Record<string, unknown>[];
  size: number;
  isLastPage: boolean;
}

export async function getUserProfile(
  clients: ApiClients,
  userSlug: string,
): Promise<Record<string, unknown>> {
  return clients.api.get(`users/${userSlug}`).json<Record<string, unknown>>();
}

export async function searchUsers(
  clients: ApiClients,
  filter: string,
  options?: { limit?: number; start?: number },
): Promise<UserSearchResult> {
  const { limit = 25, start = 0 } = options ?? {};
  return clients.api
    .get("users", {
      searchParams: { filter, limit, start },
    })
    .json<UserSearchResult>();
}
