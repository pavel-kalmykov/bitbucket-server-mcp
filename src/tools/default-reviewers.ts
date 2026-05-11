import { z } from "zod";
import { formatResponse } from "../response/format.js";
import { toolAnnotations } from "../response/annotations.js";
import { handleToolError } from "../http/errors.js";
import type { ToolContext } from "./shared.js";

interface DefaultReviewerCondition {
  id: number;
  scope: { type: string; resourceId?: number };
  reviewers: Array<{ name: string }>;
  sourceMatcher: { type: string; displayId: string };
  targetMatcher: { type: string; displayId: string };
}

export function registerDefaultReviewerTools(ctx: ToolContext) {
  const { server, clients } = ctx;

  server.registerTool(
    "list_default_reviewers",
    {
      description:
        "List default reviewer conditions for a repository. These conditions determine which users are automatically added as reviewers to pull requests.",
      inputSchema: {
        project: z
          .string()
          .optional()
          .describe("Project key. Defaults to BITBUCKET_DEFAULT_PROJECT."),
        repository: z.string().describe("Repository slug."),
      },
      annotations: toolAnnotations(),
    },
    async ({ project, repository }) => {
      try {
        const resolvedProject = ctx.resolveProject(project);
        const data = await clients.defaultReviewers
          .get(`projects/${resolvedProject}/repos/${repository}/conditions`)
          .json<DefaultReviewerCondition[]>();

        return formatResponse(data);
      } catch (error) {
        return handleToolError(error);
      }
    },
  );
}
