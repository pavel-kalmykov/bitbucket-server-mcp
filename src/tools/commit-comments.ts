import { z } from "zod";
import {
  formatResponse,
  buildPaginated,
  type ToolSuccessResult,
} from "../response/format.js";
import { toolAnnotations } from "../response/annotations.js";
import type { ToolContext } from "./shared.js";
import type { ApiClients } from "../api/http/client.js";
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
import {
  listCommitComments,
  createCommitComment,
  updateCommitComment,
  deleteCommitComment,
} from "../api/misc.js";

interface CommitCommentActionContext {
  clients: ApiClients;
  resolvedProject: string;
  repository: string;
  commitId: string;
  text?: string;
  commentId?: number;
  version?: number;
}

const commitCommentActions: Record<
  string,
  (ctx: CommitCommentActionContext) => Promise<ToolSuccessResult>
> = {
  create: async ({ clients, resolvedProject, repository, commitId, text }) => {
    const data = await createCommitComment(
      clients,
      resolvedProject,
      repository,
      commitId,
      text!,
    );
    return formatResponse(curateResponse(data, DEFAULT_COMMENT_FIELDS));
  },
  edit: async ({
    clients,
    resolvedProject,
    repository,
    commitId,
    commentId,
    text,
    version,
  }) => {
    const data = await updateCommitComment(
      clients,
      resolvedProject,
      repository,
      commitId,
      commentId!,
      { text, version },
    );
    return formatResponse(curateResponse(data, DEFAULT_COMMENT_FIELDS));
  },
  delete: async ({
    clients,
    resolvedProject,
    repository,
    commitId,
    commentId,
    version,
  }) => {
    await deleteCommitComment(
      clients,
      resolvedProject,
      repository,
      commitId,
      commentId!,
      version!,
    );
    return formatResponse({ deleted: true, commentId });
  },
};

export function registerCommitCommentTools(ctx: ToolContext) {
  const { server, clients } = ctx;

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
    async ({
      project,
      repository,
      commitId,
      limit = 25,
      start = 0,
      fields,
    }) => {
      const resolvedProject = ctx.resolveProject(project);
      const data = await listCommitComments(
        clients,
        resolvedProject,
        repository,
        commitId,
        { limit, start },
      );

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
        action: z
          .enum(["create", "edit", "delete"])
          .describe("Operation to perform."),
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
    async ({
      action,
      project,
      repository,
      commitId,
      text,
      commentId,
      version,
    }) => {
      const resolvedProject = ctx.resolveProject(project);
      return await commitCommentActions[action]({
        clients,
        resolvedProject,
        repository,
        commitId,
        text,
        commentId,
        version,
      });
    },
  );
}
