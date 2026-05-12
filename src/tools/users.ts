import { z } from "zod";
import { formatResponse } from "../response/format.js";
import { toolAnnotations } from "../response/annotations.js";
import { handleToolError } from "../http/errors.js";
import type { ToolContext } from "./shared.js";

export function registerUserTools(ctx: ToolContext) {
  const { server, clients } = ctx;

  server.registerTool(
    "get_user_profile",
    {
      description:
        "Get a Bitbucket user profile by user slug. Returns user details including display name, email, and active status.",
      inputSchema: {
        userSlug: z.string().describe("User slug (username) to look up."),
      },
      annotations: toolAnnotations(),
    },
    async ({ userSlug }) => {
      try {
        const data = await clients.api.get(`users/${userSlug}`).json();

        return formatResponse(data);
      } catch (error) {
        return handleToolError(error);
      }
    },
  );

  server.registerTool(
    "search_users",
    {
      description:
        "Search Bitbucket users by filter query. Returns matching users.",
      inputSchema: {
        filter: z
          .string()
          .describe(
            "Filter query substring to match against user names and display names.",
          ),
        limit: z
          .number()
          .optional()
          .describe("Number of users to return (default: 25)."),
        start: z
          .number()
          .optional()
          .describe("Start index for pagination (default: 0)."),
      },
      annotations: toolAnnotations(),
    },
    async ({ filter, limit = 25, start = 0 }) => {
      try {
        const data = await clients.api
          .get("users", {
            searchParams: { filter, limit, start },
          })
          .json<{ values: unknown[]; size: number; isLastPage: boolean }>();

        return formatResponse({
          total: data.size,
          users: data.values,
          isLastPage: data.isLastPage,
        });
      } catch (error) {
        return handleToolError(error);
      }
    },
  );
}
