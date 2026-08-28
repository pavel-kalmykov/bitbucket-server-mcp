import type { ApiContext } from "./context.js";
import { resolveProject } from "./context.js";

export type CommentState = "OPEN" | "PENDING" | "RESOLVED";
export type CommentSeverity = "NORMAL" | "BLOCKER";
export type LineType = "ADDED" | "REMOVED" | "CONTEXT";
export type DiffType = "EFFECTIVE" | "RANGE" | "COMMIT";
export type FileType = "TO" | "FROM";

interface CommentTarget {
  project?: string;
  repository: string;
  prId: number;
}

export interface CreateCommentParams extends CommentTarget {
  text?: string;
  parentId?: number;
  state?: CommentState;
  severity?: CommentSeverity;
  filePath?: string;
  line?: number;
  lineType?: LineType;
  diffType?: DiffType;
  fileType?: FileType;
}

export interface UpdateCommentParams extends CommentTarget {
  commentId?: number;
  text?: string;
  version?: number;
  severity?: CommentSeverity;
  state?: CommentState;
  threadResolved?: boolean;
}

export interface DeleteCommentParams extends CommentTarget {
  commentId?: number;
  version?: number;
}

export interface ReactionParams extends CommentTarget {
  commentId?: number;
  emoticon?: string;
}

export function commentsApi(ctx: ApiContext) {
  const path = ({ project, repository, prId }: CommentTarget) =>
    `projects/${resolveProject(ctx, project)}/repos/${repository}/pull-requests/${prId}/comments`;

  const reactionPath = ({ commentId, emoticon, ...target }: ReactionParams) =>
    `${path(target)}/${commentId}/reactions/${emoticon}`;

  return {
    async create(
      params: CreateCommentParams,
    ): Promise<Record<string, unknown>> {
      const {
        text,
        parentId,
        state,
        severity,
        filePath,
        line,
        lineType,
        diffType,
        fileType,
      } = params;

      const json = {
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

      return ctx.http.api
        .post(path(params), { json })
        .json<Record<string, unknown>>();
    },

    async update(
      params: UpdateCommentParams,
    ): Promise<Record<string, unknown>> {
      const { commentId, text, version, severity, state, threadResolved } =
        params;

      const json = {
        text,
        version,
        ...(severity && { severity }),
        ...(state && { state }),
        ...(threadResolved !== undefined && { threadResolved }),
      };

      return ctx.http.api
        .put(`${path(params)}/${commentId}`, { json })
        .json<Record<string, unknown>>();
    },

    async delete(
      params: DeleteCommentParams,
    ): Promise<{ deleted: true; commentId?: number }> {
      await ctx.http.api.delete(`${path(params)}/${params.commentId}`, {
        searchParams: { version: params.version! },
      });
      return { deleted: true, commentId: params.commentId };
    },

    async react(
      params: ReactionParams,
    ): Promise<{ react: true; commentId?: number; emoticon?: string }> {
      await ctx.http.commentLikes.put(reactionPath(params));
      return {
        react: true,
        commentId: params.commentId,
        emoticon: params.emoticon,
      };
    },

    async unreact(
      params: ReactionParams,
    ): Promise<{ unreact: true; commentId?: number; emoticon?: string }> {
      await ctx.http.commentLikes.delete(reactionPath(params));
      return {
        unreact: true,
        commentId: params.commentId,
        emoticon: params.emoticon,
      };
    },
  };
}

export type CommentsApi = ReturnType<typeof commentsApi>;
