import { z } from "zod";
import { formatResponse, type ToolSuccessResult } from "../response/format.js";
import { toolAnnotations } from "../response/annotations.js";
import type { ToolContext } from "./shared.js";
import type { ApiClients } from "../api/http/client.js";
import { projectParam, repositoryParam } from "./params.js";
import { curateResponse, DEFAULT_COMMENT_FIELDS } from "../response/curate.js";
import {
  createPrComment,
  updatePrComment,
  deletePrComment,
  reactToComment,
  unreactFromComment,
} from "../api/pull-requests.js";
import { searchEmoticons } from "../api/misc.js";

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
  (ctx: CommentActionContext) => Promise<ToolSuccessResult>
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
    const data = await createPrComment(
      clients,
      basePath,
      body as unknown as Record<string, unknown>,
    );
    return formatResponse(curateResponse(data, DEFAULT_COMMENT_FIELDS));
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
    const data = await updatePrComment(
      clients,
      basePath,
      commentId!,
      body as unknown as Record<string, unknown>,
    );
    return formatResponse(curateResponse(data, DEFAULT_COMMENT_FIELDS));
  },

  delete: async ({ clients, basePath, commentId, version }) => {
    await deletePrComment(clients, basePath, commentId!, version!);
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
    await reactToComment(clients, reactionPath);
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
    await unreactFromComment(clients, reactionPath);
    return formatResponse({ unreact: true, commentId, emoticon });
  },
};

export function registerCommentTools(ctx: ToolContext) {
  const { server, clients } = ctx;

  server.registerTool(
    "manage_comment",
    {
      description:
        'Manage pull request comments. Actions: "create" (general, inline, threaded, or tasks), "edit" (update text/severity/state/threadResolved), "delete", "react" (add emoji reaction), "unreact" (remove reaction).',
      inputSchema: {
        action: z
          .enum(["create", "edit", "delete", "react", "unreact"])
          .describe("Operation to perform on the comment."),
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
          .describe("Close or reopen the comment thread (edit only)."),
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
          .describe("Type of line being commented on."),
        diffType: z
          .enum(["EFFECTIVE", "RANGE", "COMMIT"])
          .optional()
          .describe("Which diff to anchor the comment on."),
        fileType: z
          .enum(["TO", "FROM"])
          .optional()
          .describe("Which side of the diff."),
        emoticon: z
          .string()
          .optional()
          .describe("Emoticon shortcut for react/unreact."),
      },
      annotations: toolAnnotations({
        readOnlyHint: false,
        idempotentHint: false,
      }),
    },
    async (params) => {
      const resolvedProject = ctx.resolveProject(params.project);
      const basePath = `projects/${resolvedProject}/repos/${params.repository}/pull-requests/${params.prId}/comments`;
      return await commentActions[params.action]({
        clients,
        basePath,
        resolvedProject,
        ...params,
      });
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
      const data = await searchEmoticons(clients, query);
      return formatResponse(data.map((e) => e.shortcut));
    },
  );
}
