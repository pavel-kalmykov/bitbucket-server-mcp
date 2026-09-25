import { z } from "zod";
import { formatResponse, buildPaginated } from "../response/format.js";
import { toolAnnotations } from "../response/annotations.js";
import type { ToolContext } from "./shared.js";
import { limitParam, startParam, fieldsParam } from "./params.js";
import {
  curateResponse,
  curateList,
  DEFAULT_USER_FIELDS,
} from "../response/curate.js";

export function registerUserTools(ctx: ToolContext) {
  const { server, bb } = ctx;

  server.registerTool(
    "get_user_profile",
    {
      description:
        "Get a Bitbucket user profile by user slug. Returns user details including display name, email, and active status.",
      inputSchema: {
        userSlug: z.string().describe("User slug (username) to look up."),
        fields: fieldsParam(),
      },
      annotations: toolAnnotations(),
    },
    async ({ fields, ...params }) => {
      const data = await bb.users.get(params);

      return formatResponse(
        curateResponse(data, fields ?? DEFAULT_USER_FIELDS),
      );
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
        limit: limitParam(),
        start: startParam(),
        fields: fieldsParam(),
      },
      annotations: toolAnnotations(),
    },
    async ({ fields, ...params }) => {
      const data = await bb.users.search(params);

      return formatResponse(
        buildPaginated(data, {
          users: curateList(data.values, fields ?? DEFAULT_USER_FIELDS),
        }),
      );
    },
  );
}
