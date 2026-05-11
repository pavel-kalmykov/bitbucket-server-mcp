import { z } from "zod";
import { formatResponse } from "../response/format.js";
import { toolAnnotations } from "../response/annotations.js";
import { handleToolError } from "../http/errors.js";
import type { ToolContext } from "./shared.js";

interface UserProfile {
  name: string;
  emailAddress: string;
  displayName: string;
  slug: string;
  active: boolean;
  id?: number;
  type?: string;
}

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
        const data = await clients.api
          .get(`users/${userSlug}`)
          .json<UserProfile>();

        return formatResponse(data);
      } catch (error) {
        return handleToolError(error);
      }
    },
  );
}
