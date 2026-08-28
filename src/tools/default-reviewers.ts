import { formatResponse } from "../response/format.js";
import { toolAnnotations } from "../response/annotations.js";
import type { ToolContext } from "./shared.js";
import { projectParam, repositoryParam, fieldsParam } from "./params.js";
import { curateList, DEFAULT_REVIEWER_FIELDS } from "../response/curate.js";

export function registerDefaultReviewerTools(ctx: ToolContext) {
  const { server, bb } = ctx;

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
    async ({ fields, ...params }) => {
      const conditions = await bb.defaultReviewers.list(params);

      return formatResponse(
        curateList(conditions, fields ?? DEFAULT_REVIEWER_FIELDS),
      );
    },
  );
}
