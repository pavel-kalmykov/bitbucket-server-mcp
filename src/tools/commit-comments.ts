import { z } from "zod";
import {
  formatResponse,
  buildPaginated,
  type ToolSuccessResult,
} from "../response/format.js";
import { toolAnnotations } from "../response/annotations.js";
import type { ToolContext } from "./shared.js";
import {
  projectParam,
  repositoryParam,
  limitParam,
  startParam,
  fieldsParam,
} from "./params.js";
import {
  curateResponse,
  curateList,
  DEFAULT_COMMENT_FIELDS,
} from "../response/curate.js";

const actionParam = z
  .enum(["create", "edit", "delete"])
  .describe("Operation to perform.");
type CommitCommentAction = z.infer<typeof actionParam>;

export function registerCommitCommentTools(ctx: ToolContext) {
  const { server, bb } = ctx;

  server.registerTool(
    "list_commit_comments",
    {
      description:
        "Get comments for a specific commit. Returns all comments on the commit with pagination support.",
      inputSchema: {
        project: projectParam(),
        repository: repositoryParam(),
        commitId: z.string().describe("Full commit hash."),
        limit: limitParam(),
        start: startParam(),
        fields: fieldsParam(),
      },
      annotations: toolAnnotations(),
    },
    async ({ fields, ...params }) => {
      const data = await bb.commitComments.list(params);

      return formatResponse(
        buildPaginated(data, {
          comments: curateList(data.values, fields ?? DEFAULT_COMMENT_FIELDS),
        }),
      );
    },
  );

  server.registerTool(
    "manage_commit_comments",
    {
      description:
        'Manage comments on a commit. Actions: "create" (add a new comment), "edit" (update an existing comment), "delete" (remove a comment).',
      inputSchema: {
        action: actionParam,
        project: projectParam(),
        repository: repositoryParam(),
        commitId: z.string().describe("Full commit hash."),
        text: z
          .string()
          .optional()
          .describe("Comment text (required for create and edit)."),
        commentId: z
          .number()
          .optional()
          .describe("Comment ID (required for edit and delete)."),
        version: z
          .number()
          .optional()
          .describe(
            "Comment version for optimistic locking (required for edit and delete).",
          ),
      },
      annotations: toolAnnotations({
        readOnlyHint: false,
        idempotentHint: false,
      }),
    },
    async ({ action, ...params }) => {
      const run: Record<CommitCommentAction, () => Promise<ToolSuccessResult>> =
        {
          create: async () =>
            formatResponse(
              curateResponse(
                await bb.commitComments.create(params),
                DEFAULT_COMMENT_FIELDS,
              ),
            ),
          edit: async () =>
            formatResponse(
              curateResponse(
                await bb.commitComments.update(params),
                DEFAULT_COMMENT_FIELDS,
              ),
            ),
          delete: async () =>
            formatResponse(await bb.commitComments.delete(params)),
        };

      return run[action]();
    },
  );
}
