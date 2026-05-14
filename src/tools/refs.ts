import { z } from "zod";
import { formatResponse } from "../response/format.js";
import { toolAnnotations } from "../response/annotations.js";
import { handleToolError } from "../http/errors.js";
import {
  curateList,
  curateResponse,
  DEFAULT_BRANCH_FIELDS,
  DEFAULT_COMMIT_FIELDS,
  DEFAULT_TAG_FIELDS,
} from "../response/curate.js";
import { getPaginated } from "../http/client.js";
import type { ToolContext } from "./shared.js";
import type { ApiClients } from "../http/client.js";
import type { Commit as BaseCommit } from "../generated/types.js";

// Extend: the API returns slug/displayName on author but the spec doesn't document them
type Commit = BaseCommit & {
  author?: { name?: string; slug?: string; displayName?: string };
};

interface BranchActionContext {
  clients: ApiClients;
  resolvedProject: string;
  repository: string;
  branch: string;
  startPoint?: string;
}

const branchActions: Record<
  string,
  (ctx: BranchActionContext) => Promise<ReturnType<typeof formatResponse>>
> = {
  create: async ({
    clients,
    resolvedProject,
    repository,
    branch,
    startPoint,
  }) => {
    const data = await clients.branchUtils
      .post(`projects/${resolvedProject}/repos/${repository}/branches`, {
        json: { name: `refs/heads/${branch}`, startPoint },
      })
      .json();
    return formatResponse(data);
  },
  delete: async ({ clients, resolvedProject, repository, branch }) => {
    const defaultBranch = await clients.api
      .get(`projects/${resolvedProject}/repos/${repository}/default-branch`)
      .json<{ displayId?: string }>();
    if (defaultBranch.displayId === branch) {
      throw new Error(`Cannot delete the default branch "${branch}".`);
    }
    await clients.branchUtils
      .post(`projects/${resolvedProject}/repos/${repository}/branches`, {
        json: { name: `refs/heads/${branch}`, dryRun: false },
      })
      .json();
    return formatResponse({ deleted: true, branch });
  },
};

export function registerBranchTools(ctx: ToolContext) {
  const { server, clients } = ctx;

  server.registerTool(
    "list_branch_restrictions",
    {
      description:
        "List branch restrictions for a repository. These control which users/groups can push to or delete specific branches or branch patterns.",
      inputSchema: {
        project: z
          .string()
          .optional()
          .describe("Project key. Defaults to BITBUCKET_DEFAULT_PROJECT."),
        repository: z.string().describe("Repository slug."),
        limit: z
          .number()
          .optional()
          .describe("Number of restrictions to return (default: 25)."),
        start: z
          .number()
          .optional()
          .describe("Start index for pagination (default: 0)."),
      },
      annotations: toolAnnotations(),
    },
    async ({ project, repository, limit = 25, start = 0 }) => {
      try {
        const resolvedProject = ctx.resolveProject(project);
        const data = await getPaginated(
          clients.branchUtils,
          `projects/${resolvedProject}/repos/${repository}/restrictions`,
          { searchParams: { limit, start } },
        ).catch((e) => {
          if (
            e &&
            typeof e === "object" &&
            "response" in e &&
            (e as { response?: { status?: number } }).response?.status === 404
          ) {
            return { values: [], size: 0, isLastPage: true } as const;
          }
          throw e;
        });

        return formatResponse({
          total: data.size,
          restrictions: data.values,
          isLastPage: data.isLastPage,
        });
      } catch (error) {
        return handleToolError(error);
      }
    },
  );

  server.registerTool(
    "list_branches",
    {
      description:
        "List branches in a repository. Also returns the default branch when available. Supports custom field selection via the `fields` param (`'*all'` for full raw response, `'displayId,latestCommit'` for a custom subset).",
      inputSchema: {
        project: z
          .string()
          .optional()
          .describe("Project key. Defaults to BITBUCKET_DEFAULT_PROJECT."),
        repository: z.string().describe("Repository slug."),
        filterText: z
          .string()
          .optional()
          .describe("Filter branches by name substring."),
        limit: z
          .number()
          .optional()
          .describe("Number of branches to return (default: 25, max: 1000)."),
        start: z
          .number()
          .optional()
          .describe("Start index for pagination (default: 0)."),
        fields: z
          .string()
          .optional()
          .describe(
            "Comma-separated fields to return. Defaults to: id, displayId, type, latestCommit, isDefault, metadata. Use '*all' for the full API response.",
          ),
      },
      annotations: toolAnnotations(),
    },
    async ({
      project,
      repository,
      filterText,
      limit = 25,
      start = 0,
      fields,
    }) => {
      try {
        const resolvedProject = ctx.resolveProject(project);
        const searchParams: Record<string, string | number> = { limit, start };
        if (filterText) searchParams.filterText = filterText;

        const [branchData, defaultBranch] = await Promise.all([
          getPaginated(
            clients.api,
            `projects/${resolvedProject}/repos/${repository}/branches`,
            { searchParams },
          ),
          clients.api
            .get(
              `projects/${resolvedProject}/repos/${repository}/default-branch`,
            )
            .json<Record<string, unknown>>()
            .catch(() => null),
        ]);

        const activeFields = fields ?? DEFAULT_BRANCH_FIELDS;

        return formatResponse({
          total: branchData.size,
          branches: curateList(branchData.values, activeFields),
          isLastPage: branchData.isLastPage,
          defaultBranch: defaultBranch
            ? curateResponse(defaultBranch, activeFields)
            : null,
        });
      } catch (error) {
        return handleToolError(error);
      }
    },
  );

  server.registerTool(
    "list_commits",
    {
      description:
        "List commits in a repository, optionally filtered by branch and author. Supports custom field selection via the `fields` param (`'*all'` for full raw response, `'id,message,author.name'` for a custom subset).",
      inputSchema: {
        project: z
          .string()
          .optional()
          .describe("Project key. Defaults to BITBUCKET_DEFAULT_PROJECT."),
        repository: z.string().describe("Repository slug."),
        branch: z
          .string()
          .optional()
          .describe("Branch name to list commits from."),
        author: z
          .string()
          .optional()
          .describe(
            "Client-side filter by author (case-insensitive match on name, slug, or displayName). Only filters the current page of results. Use with start/limit to paginate for more matches.",
          ),
        limit: z
          .number()
          .optional()
          .describe("Number of commits to return (default: 25, max: 1000)."),
        start: z
          .number()
          .optional()
          .describe("Start index for pagination (default: 0)."),
        fields: z
          .string()
          .optional()
          .describe(
            "Comma-separated fields to return. Defaults to: id, displayId, message, author (name, email), authorTimestamp, parents. Use '*all' for the full API response.",
          ),
      },
      annotations: toolAnnotations(),
    },
    async ({
      project,
      repository,
      branch,
      author,
      limit = 25,
      start = 0,
      fields,
    }) => {
      try {
        const resolvedProject = ctx.resolveProject(project);
        const searchParams: Record<string, string | number> = { limit, start };
        if (branch) searchParams.until = branch;

        const data = await getPaginated(
          clients.api,
          `projects/${resolvedProject}/repos/${repository}/commits`,
          { searchParams },
        );

        let commits = data.values as Commit[];

        if (author) {
          const authorLower = author.toLowerCase();
          commits = commits.filter((commit) => {
            const a = commit.author;
            return (
              a?.name?.toLowerCase().includes(authorLower) ||
              a?.slug?.toLowerCase().includes(authorLower) ||
              a?.displayName?.toLowerCase().includes(authorLower)
            );
          });
        }

        return formatResponse({
          total: author ? commits.length : data.size,
          commits: curateList(
            commits as Record<string, unknown>[],
            fields ?? DEFAULT_COMMIT_FIELDS,
          ),
          isLastPage: data.isLastPage,
        });
      } catch (error) {
        return handleToolError(error);
      }
    },
  );

  server.registerTool(
    "manage_branches",
    {
      description:
        'Manage branches in a repository. Actions: "create" (create a new branch), "delete" (delete a branch). Refuses to delete the default branch.',
      inputSchema: {
        action: z.enum(["create", "delete"]).describe("Operation to perform."),
        project: z
          .string()
          .optional()
          .describe("Project key. Defaults to BITBUCKET_DEFAULT_PROJECT."),
        repository: z.string().describe("Repository slug."),
        branch: z.string().describe("Branch name."),
        startPoint: z
          .string()
          .optional()
          .describe("Ref to branch from (create only)."),
      },
      annotations: toolAnnotations({
        readOnlyHint: false,
        destructiveHint: true,
        idempotentHint: false,
      }),
    },
    async ({ action, project, repository, branch, startPoint }) => {
      try {
        const resolvedProject = ctx.resolveProject(project);
        const handler = branchActions[action];
        if (!handler) {
          throw new Error(`Unknown action: ${action}`);
        }
        return await handler({
          clients,
          resolvedProject,
          repository,
          branch,
          startPoint,
        });
      } catch (error) {
        return handleToolError(error);
      }
    },
  );

  server.registerTool(
    "get_commit",
    {
      description:
        "Get details of a specific commit by its ID. Supports custom field selection via the `fields` param (`'*all'` for full raw response, `'id,message,author.name'` for a custom subset).",
      inputSchema: {
        project: z
          .string()
          .optional()
          .describe("Project key. Defaults to BITBUCKET_DEFAULT_PROJECT."),
        repository: z.string().describe("Repository slug."),
        commitId: z.string().describe("Full commit hash."),
        fields: z
          .string()
          .optional()
          .describe(
            "Comma-separated fields to return. Defaults to: id, displayId, message, author (name, email), authorTimestamp, committer (name, email), committerTimestamp, parents (id). Use '*all' for the full API response.",
          ),
      },
      annotations: toolAnnotations(),
    },
    async ({ project, repository, commitId, fields }) => {
      try {
        const resolvedProject = ctx.resolveProject(project);
        const data = await clients.api
          .get(
            `projects/${resolvedProject}/repos/${repository}/commits/${commitId}`,
          )
          .json<Record<string, unknown>>();

        return formatResponse(
          curateResponse(data, fields ?? DEFAULT_COMMIT_FIELDS),
        );
      } catch (error) {
        return handleToolError(error);
      }
    },
  );

  server.registerTool(
    "compare_refs",
    {
      description:
        "Compare two refs and list commits accessible from `to` but not from `from`. Supports custom field selection via the `fields` param (`'*all'` for full raw response, `'id,message,author.name'` for a custom subset).",
      inputSchema: {
        project: z
          .string()
          .optional()
          .describe("Project key. Defaults to BITBUCKET_DEFAULT_PROJECT."),
        repository: z.string().describe("Repository slug."),
        from: z
          .string()
          .optional()
          .describe("Source ref (commits reachable from here are excluded)."),
        to: z
          .string()
          .optional()
          .describe("Target ref (commits reachable from here are included)."),
        limit: z
          .number()
          .optional()
          .describe("Number of commits to return (default: 25, max: 1000)."),
        start: z
          .number()
          .optional()
          .describe("Start index for pagination (default: 0)."),
        fields: z
          .string()
          .optional()
          .describe(
            "Comma-separated fields to return. Defaults to: id, displayId, message, author (name, email), authorTimestamp, committer (name, email), committerTimestamp, parents (id). Use '*all' for the full API response.",
          ),
      },
      annotations: toolAnnotations(),
    },
    async ({
      project,
      repository,
      from,
      to,
      limit = 25,
      start = 0,
      fields,
    }) => {
      try {
        const resolvedProject = ctx.resolveProject(project);
        const searchParams: Record<string, string | number> = {
          limit,
          start,
        };
        if (from) searchParams.from = from;
        if (to) searchParams.to = to;

        const data = await getPaginated(
          clients.api,
          `projects/${resolvedProject}/repos/${repository}/compare/commits`,
          { searchParams },
        );

        return formatResponse({
          total: data.size,
          commits: curateList(
            data.values as Record<string, unknown>[],
            fields ?? DEFAULT_COMMIT_FIELDS,
          ),
          isLastPage: data.isLastPage,
        });
      } catch (error) {
        return handleToolError(error);
      }
    },
  );

  server.registerTool(
    "list_tags",
    {
      description:
        "List tags in a repository. Supports custom field selection via the `fields` param (`'*all'` for full raw response, `'id,displayId,hash'` for a custom subset).",
      inputSchema: {
        project: z
          .string()
          .optional()
          .describe("Project key. Defaults to BITBUCKET_DEFAULT_PROJECT."),
        repository: z.string().describe("Repository slug."),
        filterText: z
          .string()
          .optional()
          .describe("Filter tags by name substring."),
        limit: z
          .number()
          .optional()
          .describe("Number of tags to return (default: 25, max: 1000)."),
        start: z
          .number()
          .optional()
          .describe("Start index for pagination (default: 0)."),
        fields: z
          .string()
          .optional()
          .describe(
            "Comma-separated fields to return. Defaults to: id, displayId, type, hash, latestCommit. Use '*all' for the full API response.",
          ),
      },
      annotations: toolAnnotations(),
    },
    async ({
      project,
      repository,
      filterText,
      limit = 25,
      start = 0,
      fields,
    }) => {
      try {
        const resolvedProject = ctx.resolveProject(project);
        const searchParams: Record<string, string | number> = { limit, start };
        if (filterText) searchParams.filterText = filterText;

        const data = await getPaginated(
          clients.api,
          `projects/${resolvedProject}/repos/${repository}/tags`,
          { searchParams },
        );

        return formatResponse({
          total: data.size,
          tags: curateList(
            data.values as Record<string, unknown>[],
            fields ?? DEFAULT_TAG_FIELDS,
          ),
          isLastPage: data.isLastPage,
        });
      } catch (error) {
        return handleToolError(error);
      }
    },
  );

  interface TagActionContext {
    clients: ApiClients;
    resolvedProject: string;
    repository: string;
    name: string;
    startPoint?: string;
    message?: string;
  }

  const tagActions: Record<
    string,
    (ctx: TagActionContext) => Promise<ReturnType<typeof formatResponse>>
  > = {
    create: async ({
      clients,
      resolvedProject,
      repository,
      name,
      startPoint,
      message,
    }) => {
      const data = await clients.api
        .post(`projects/${resolvedProject}/repos/${repository}/tags`, {
          json: {
            name: `refs/tags/${name}`,
            startPoint,
            message,
          },
        })
        .json();
      return formatResponse(data);
    },
    delete: async ({ clients, resolvedProject, repository, name }) => {
      await clients.git
        .delete(`projects/${resolvedProject}/repos/${repository}/tags/${name}`)
        .json();
      return formatResponse({ deleted: true, tag: name });
    },
  };

  server.registerTool(
    "get_tag",
    {
      description:
        "Get details of a specific tag by its name. Supports custom field selection via the `fields` param (`'*all'` for full raw response, `'id,displayId,hash'` for a custom subset).",
      inputSchema: {
        project: z
          .string()
          .optional()
          .describe("Project key. Defaults to BITBUCKET_DEFAULT_PROJECT."),
        repository: z.string().describe("Repository slug."),
        name: z.string().describe("Tag name (e.g. 'v1.0.0')."),
        fields: z
          .string()
          .optional()
          .describe(
            "Comma-separated fields to return. Defaults to: id, displayId, type, hash, latestCommit. Use '*all' for the full API response.",
          ),
      },
      annotations: toolAnnotations(),
    },
    async ({ project, repository, name, fields }) => {
      try {
        const resolvedProject = ctx.resolveProject(project);
        const data = await clients.api
          .get(`projects/${resolvedProject}/repos/${repository}/tags/${name}`)
          .json<Record<string, unknown>>();

        return formatResponse(
          curateResponse(data, fields ?? DEFAULT_TAG_FIELDS),
        );
      } catch (error) {
        return handleToolError(error);
      }
    },
  );

  server.registerTool(
    "manage_tags",
    {
      description:
        'Manage tags in a repository. Actions: "create" (create a new tag pointing to a commit), "delete" (delete a tag by name).',
      inputSchema: {
        action: z.enum(["create", "delete"]).describe("Operation to perform."),
        project: z
          .string()
          .optional()
          .describe("Project key. Defaults to BITBUCKET_DEFAULT_PROJECT."),
        repository: z.string().describe("Repository slug."),
        name: z.string().describe("Tag name (e.g. 'v1.0.0')."),
        startPoint: z
          .string()
          .optional()
          .describe("Commit hash to tag (create only)."),
        message: z
          .string()
          .optional()
          .describe("Optional message for the tag (create only)."),
      },
      annotations: toolAnnotations({
        readOnlyHint: false,
        destructiveHint: true,
        idempotentHint: false,
      }),
    },
    async ({ action, project, repository, name, startPoint, message }) => {
      try {
        const resolvedProject = ctx.resolveProject(project);
        const handler = tagActions[action];
        if (!handler) {
          throw new Error(`Unknown action: ${action}`);
        }
        return await handler({
          clients,
          resolvedProject,
          repository,
          name,
          startPoint,
          message,
        });
      } catch (error) {
        return handleToolError(error);
      }
    },
  );
}
