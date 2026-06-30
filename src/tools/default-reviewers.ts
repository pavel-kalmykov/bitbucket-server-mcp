import { formatResponse } from "../response/format.js";
import { toolAnnotations } from "../response/annotations.js";
import { handleToolError } from "../http/errors.js";
import type { ToolContext } from "./shared.js";
import { projectParam, repositoryParam, fieldsParam } from "./params.js";
import { curateList, DEFAULT_REVIEWER_FIELDS } from "../response/curate.js";

export function registerDefaultReviewerTools(ctx: ToolContext) {
  const { server, clients } = ctx;

  server.registerTool(
    "list_default_reviewer_conditions",
    {
      description:
        "List default reviewer conditions for a repository. These conditions determine which users are automatically added as reviewers to pull requests.",
      inputSchema: {
        project: projectParam(),
        repository: repositoryParam(),
        fields: fieldsParam(),
      },
      annotations: toolAnnotations(),
    },
    async ({ project, repository, fields }) => {
      try {
        const resolvedProject = ctx.resolveProject(project);
        const data = await clients.defaultReviewers
          .get(`projects/${resolvedProject}/repos/${repository}/conditions`)
          .json<Record<string, unknown>[]>();

        return formatResponse(
          curateList(data, fields ?? DEFAULT_REVIEWER_FIELDS),
        );
      } catch (error) {
        return handleToolError(error);
      }
    },
  );
}
