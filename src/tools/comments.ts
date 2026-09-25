import { z } from "zod";
import { formatResponse, type ToolSuccessResult } from "../response/format.js";
import { toolAnnotations } from "../response/annotations.js";
import type { ToolContext } from "./shared.js";
import { projectParam, repositoryParam } from "./params.js";
import { curateResponse, DEFAULT_COMMENT_FIELDS } from "../response/curate.js";

const actionParam = z
  .enum(["create", "edit", "delete", "react", "unreact"])
  .describe("Operation to perform on the comment.");
type CommentAction = z.infer<typeof actionParam>;

export function registerCommentTools(ctx: ToolContext) {
  const { server, bb } = ctx;

  server.registerTool(
    "manage_comment",
    {
      description:
        'Manage pull request comments. Actions: "create" (general, inline, threaded, or tasks), "edit" (update text/severity/state/threadResolved), "delete", "react" (add emoji reaction), "unreact" (remove reaction). `state: RESOLVED` toggles the task checkbox on a BLOCKER comment; `threadResolved: true` closes the conversation (the "Resolve" button in the UI). They are independent and can be passed together.',
      inputSchema: {
        action: actionParam,
        project: projectParam(),
        repository: repositoryParam(),
        prId: z.coerce.number().describe("Pull request ID."),
        text: z
          .string()
          .optional()
          .describe("Comment text (required for create and edit)."),
        commentId: z
          .number()
          .optional()
          .describe("Comment ID (required for edit, delete, react, unreact)."),
        version: z
          .number()
          .optional()
          .describe(
            "Comment version for optimistic locking (required for edit and delete).",
          ),
        parentId: z
          .number()
          .optional()
          .describe("Parent comment ID for threaded replies (create only)."),
        state: z
          .enum(["OPEN", "PENDING", "RESOLVED"])
          .optional()
          .describe(
            "Comment state. PENDING = draft (create only). RESOLVED = mark as resolved (edit only). OPEN = reopen (edit only).",
          ),
        severity: z
          .enum(["NORMAL", "BLOCKER"])
          .optional()
          .describe(
            "Comment severity. BLOCKER marks it as a task (create and edit).",
          ),
        threadResolved: z
          .boolean()
          .optional()
          .describe(
            "Close or reopen the comment thread (edit only). Independent of `state`. Requires Bitbucket Data Center >= 8.9; older servers accept the PUT but ignore the field.",
          ),
        filePath: z
          .string()
          .optional()
          .describe("File path for inline comments (create only)."),
        line: z
          .number()
          .optional()
          .describe("Line number for inline comments (create only)."),
        lineType: z
          .enum(["ADDED", "REMOVED", "CONTEXT"])
          .optional()
          .describe(
            "Type of line being commented on. ADDED = new line, REMOVED = deleted line, CONTEXT = unchanged line visible in the diff.",
          ),
        diffType: z
          .enum(["EFFECTIVE", "RANGE", "COMMIT"])
          .optional()
          .describe(
            "Which diff to anchor the comment on. EFFECTIVE = overall PR diff (default). COMMIT = a single commit's diff. RANGE = diff between two specific commits.",
          ),
        fileType: z
          .enum(["TO", "FROM"])
          .optional()
          .describe(
            "Which side of the diff. TO = new version (default). FROM = old version (useful for renames).",
          ),
        emoticon: z
          .string()
          .optional()
          .describe(
            "Emoticon shortcut for react/unreact (e.g. thumbsup, heart, tada). Use search_emoticons to find available options.",
          ),
      },
      annotations: toolAnnotations({
        readOnlyHint: false,
        idempotentHint: false,
      }),
    },
    async ({ action, ...params }) => {
      const curated = async (data: Promise<Record<string, unknown>>) =>
        formatResponse(curateResponse(await data, DEFAULT_COMMENT_FIELDS));

      const run: Record<CommentAction, () => Promise<ToolSuccessResult>> = {
        create: async () => curated(bb.comments.create(params)),
        edit: async () => curated(bb.comments.update(params)),
        delete: async () => formatResponse(await bb.comments.delete(params)),
        react: async () => formatResponse(await bb.comments.react(params)),
        unreact: async () => formatResponse(await bb.comments.unreact(params)),
      };

      return run[action]();
    },
  );

  server.registerTool(
    "search_emoticons",
    {
      description:
        "Search available emoticons for comment reactions. Returns matching shortcut names to use with manage_comment react/unreact.",
      inputSchema: {
        query: z.string().describe("Search term (e.g. thumb, fire, heart)."),
      },
      annotations: toolAnnotations(),
    },
    async (params) => {
      const emoticons = await bb.emoticons.search(params);

      return formatResponse(emoticons.map((emoticon) => emoticon.shortcut));
    },
  );
}
