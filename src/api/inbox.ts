import { getPaginated } from "./http/client.js";
import type { Paginated } from "./http/pagination.js";
import type { ApiContext } from "./context.js";

export interface InboxApi {
  listPullRequests(
    params?: InboxPullRequestsParams,
  ): Promise<Paginated<Record<string, unknown>>>;
  count(): Promise<InboxCount>;
}

export interface InboxPullRequestsParams {
  role?: "AUTHOR" | "REVIEWER";
  participantStatus?: "UNAPPROVED" | "APPROVED" | "NEEDS_WORK";
  limit?: number;
  start?: number;
}

export interface InboxCount {
  count: number;
}

export function inboxApi(ctx: ApiContext) {
  return {
    async listPullRequests(
      params: InboxPullRequestsParams = {},
    ): Promise<Paginated<Record<string, unknown>>> {
      const searchParams: Record<string, string | number> = {};
      if (params.role) searchParams.role = params.role;
      if (params.participantStatus) {
        searchParams.participantStatus = params.participantStatus;
      }
      if (params.limit !== undefined) searchParams.limit = params.limit;
      if (params.start !== undefined) searchParams.start = params.start;

      return getPaginated(ctx.http.api, "inbox/pull-requests", {
        searchParams,
      });
    },

    async count(): Promise<InboxCount> {
      return ctx.http.api.get("inbox/pull-requests/count").json<InboxCount>();
    },
  };
}
