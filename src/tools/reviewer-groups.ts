import { z } from "zod";
import { formatResponse } from "../response/format.js";
import { toolAnnotations } from "../response/annotations.js";
import type { ToolContext } from "./shared.js";
import { projectParam, repositoryParam, fieldsParam } from "./params.js";
import {
  curateList,
  DEFAULT_REVIEWER_GROUP_FIELDS,
} from "../response/curate.js";

export function registerReviewerGroupTools(ctx: ToolContext) {
  const { server, bb } = ctx;

  server.registerTool(
    "list_reviewer_groups",
    {
      description: "List reviewer groups configured for a repository.",
      inputSchema: {
        project: projectParam(),
        repository: repositoryParam(),
        fields: fieldsParam(),
      },
      annotations: toolAnnotations(),
    },
    async ({ fields, ...params }) => {
      const groups = await bb.reviewerGroups.list(params);

      return formatResponse(
        curateList(groups, fields ?? DEFAULT_REVIEWER_GROUP_FIELDS),
      );
    },
  );

  server.registerTool(
    "create_reviewer_group",
    {
      description:
        "Create a reviewer group for a repository with one or more reviewers.",
      inputSchema: {
        project: projectParam(),
        repository: repositoryParam(),
        name: z.string().describe("Reviewer group name."),
        description: z.string().optional().describe("Group description."),
        reviewers: z
          .array(z.string())
          .min(1)
          .describe("Usernames to include in the group (at least one)."),
      },
      annotations: toolAnnotations({
        readOnlyHint: false,
        idempotentHint: false,
      }),
    },
    async (params) => formatResponse(await bb.reviewerGroups.create(params)),
  );

  server.registerTool(
    "delete_reviewer_group",
    {
      description: "Delete a reviewer group from a repository by name.",
      inputSchema: {
        project: projectParam(),
        repository: repositoryParam(),
        name: z.string().describe("Reviewer group name."),
      },
      annotations: toolAnnotations({
        readOnlyHint: false,
        idempotentHint: false,
      }),
    },
    async (params) => formatResponse(await bb.reviewerGroups.delete(params)),
  );
}
