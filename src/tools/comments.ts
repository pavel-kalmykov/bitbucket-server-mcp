import { z } from "zod";
import { formatResponse } from "../response/format.js";
import { toolAnnotations } from "../response/annotations.js";
import { handleToolError } from "../http/errors.js";
import type { ToolContext } from "./shared.js";
import type { ApiClients } from "../http/client.js";

interface CommentActionContext {
  clients: ApiClients;
  basePath: string;
  resolvedProject: string;
  repository: string;
  prId: number;
  text?: string;
  commentId?: number;
  version?: number;
  parentId?: number;
  state?: "OPEN" | "PENDING" | "RESOLVED";
  severity?: "NORMAL" | "BLOCKER";
  threadResolved?: boolean;
  filePath?: string;
  line?: number;
  lineType?: "ADDED" | "REMOVED" | "CONTEXT";
  diffType?: "EFFECTIVE" | "RANGE" | "COMMIT";
  fileType?: "TO" | "FROM";
  emoticon?: string;
}

interface CommentAnchor {
  path: string;
  lineType?: "ADDED" | "REMOVED" | "CONTEXT";
  line?: number;
  diffType: "EFFECTIVE" | "RANGE" | "COMMIT";
  fileType: "TO" | "FROM";
}

interface CreateCommentBody {
  text?: string;
  parent?: { id: number };
  state?: string;
  severity?: string;
  anchor?: CommentAnchor;
}

interface EditCommentBody {
  text?: string;
  version?: number;
  severity?: string;
  state?: string;
  threadResolved?: boolean;
}

const commentActions: Record<
  string,
  (ctx: CommentActionContext) => Promise<ReturnType<typeof formatResponse>>
> = {
  create: async ({
    clients,
    basePath,
    text,
    parentId,
    state,
    severity,
    filePath,
    line,
    lineType,
    diffType,
    fileType,
  }) => {
    const body: CreateCommentBody = {
      text,
      parent: parentId ? { id: parentId } : undefined,
      ...(state && { state }),
      ...(severity && { severity }),
      ...(filePath && {
        anchor: {
          path: filePath,
          lineType,
          line,
          diffType: diffType ?? "EFFECTIVE",
          fileType: fileType ?? "TO",
        },
      }),
    };
    const data = await clients.api.post(basePath, { json: body }).json();
    return formatResponse(data);
  },

  edit: async ({
    clients,
    basePath,
    commentId,
    text,
    version,
    severity,
    state,
    threadResolved,
  }) => {
    const body: EditCommentBody = {
      text,
      version,
      ...(severity && { severity }),
      ...(state && { state }),
      ...(threadResolved !== undefined && { threadResolved }),
    };
    const data = await clients.api
      .put(`${basePath}/${commentId}`, { json: body })
      .json();
    return formatResponse(data);
  },

  delete: async ({ clients, basePath, commentId, version }) => {
    await clients.api.delete(`${basePath}/${commentId}`, {
      searchParams: { version: version! },
    });
    return formatResponse({ deleted: true, commentId });
  },

  react: async ({
    clients,
    resolvedProject,
    repository,
    prId,
    commentId,
    emoticon,
  }) => {
    const reactionPath = `projects/${resolvedProject}/repos/${repository}/pull-requests/${prId}/comments/${commentId}/reactions/${emoticon}`;
    await clients.commentLikes.put(reactionPath);
    return formatResponse({ react: true, commentId, emoticon });
  },

  unreact: async ({
    clients,
    resolvedProject,
    repository,
    prId,
    commentId,
    emoticon,
  }) => {
    const reactionPath = `projects/${resolvedProject}/repos/${repository}/pull-requests/${prId}/comments/${commentId}/reactions/${emoticon}`;
    await clients.commentLikes.delete(reactionPath);
    return formatResponse({ unreact: true, commentId, emoticon });
  },
};

export function registerCommentTools(ctx: ToolContext) {
  const { server, clients } = ctx;

  server.registerTool(
    "manage_comment",
    {
      description:
        'Manage pull request comments. Actions: "create" (general, inline, threaded, or tasks), "edit" (update text/severity/state/threadResolved), "delete", "react" (add emoji reaction), "unreact" (remove reaction). `state: RESOLVED` toggles the task checkbox on a BLOCKER comment; `threadResolved: true` closes the conversation (the "Resolve" button in the UI). They are independent and can be passed together.',
      inputSchema: {
        action: z
          .enum(["create", "edit", "delete", "react", "unreact"])
          .describe("Operation to perform on the comment."),
        project: z
          .string()
          .optional()
          .describe("Project key. Defaults to BITBUCKET_DEFAULT_PROJECT."),
        repository: z.string().describe("Repository slug."),
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
    async (params) => {
      try {
        const resolvedProject = ctx.resolveProject(params.project);
        const basePath = `projects/${resolvedProject}/repos/${params.repository}/pull-requests/${params.prId}/comments`;
        const handler = commentActions[params.action];
        return await handler({
          clients,
          basePath,
          resolvedProject,
          ...params,
        });
      } catch (error) {
        return handleToolError(error);
      }
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
    async ({ query }) => {
      try {
        const data = await clients.emoticons
          .get("search", { searchParams: { query } })
          .json<{ values: Array<{ shortcut: string }> }>();
        return formatResponse(data.values.map((e) => e.shortcut));
      } catch (error) {
        return handleToolError(error);
      }
    },
  );
}
