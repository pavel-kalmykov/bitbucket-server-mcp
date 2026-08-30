import { z } from "zod";
import { formatResponse, type ToolSuccessResult } from "../response/format.js";
import { toolAnnotations } from "../response/annotations.js";
import type { ToolContext } from "./shared.js";
import { projectParam, repositoryParam, fieldsParam } from "./params.js";
import {
  curateList,
  DEFAULT_REVIEWER_GROUP_FIELDS,
} from "../response/curate.js";

const actionParam = z
  .enum(["create", "delete"])
  .describe("Operation to perform.");
type ReviewerGroupAction = z.infer<typeof actionParam>;

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
    "manage_reviewer_groups",
    {
      description:
        'Manage reviewer groups for a repository. Actions: "create" (create a group), "delete" (remove a group).',
      inputSchema: {
        action: actionParam,
        project: projectParam(),
        repository: repositoryParam(),
        name: z.string().describe("Reviewer group name."),
        description: z
          .string()
          .optional()
          .describe("Group description (create only)."),
        reviewers: z
          .array(z.string())
          .optional()
          .describe("Usernames to include in the group (create only)."),
      },
      annotations: toolAnnotations({
        readOnlyHint: false,
        idempotentHint: false,
      }),
    },
    async ({ action, ...params }) => {
      const run: Record<ReviewerGroupAction, () => Promise<ToolSuccessResult>> =
        {
          create: async () =>
            formatResponse(await bb.reviewerGroups.create(params)),
          delete: async () =>
            formatResponse(await bb.reviewerGroups.delete(params)),
        };

      return run[action]();
    },
  );
}
