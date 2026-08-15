import { z } from "zod";
import {
  formatResponse,
  buildPaginated,
  type ToolSuccessResult,
} from "../response/format.js";
import { toolAnnotations } from "../response/annotations.js";
import {
  curateList,
  curateResponse,
  DEFAULT_BRANCH_FIELDS,
  DEFAULT_COMMIT_FIELDS,
} from "../response/curate.js";
import type { ToolContext } from "./shared.js";
import type { ApiClients } from "../api/http/client.js";
import {
  projectParam,
  repositoryParam,
  limitParam,
  startParam,
  fieldsParam,
} from "./params.js";
import type { Commit as BaseCommit } from "../generated/types.js";
import {
  listBranchRestrictions,
  listBranches,
  listCommits,
  createBranch,
  deleteBranch,
  getCommit,
  compareRefs,
} from "../api/branches.js";

type Commit = BaseCommit & {
  author?: { name?: string; slug?: string; displayName?: string };
};

const branchActions: Record<
  string,
  (ctx: {
    clients: ApiClients;
    resolvedProject: string;
    repository: string;
    branch: string;
    startPoint?: string;
  }) => Promise<ToolSuccessResult>
> = {
  create: async ({
    clients,
    resolvedProject,
    repository,
    branch,
    startPoint,
  }) => {
    const data = await createBranch(
      clients,
      resolvedProject,
      repository,
      branch,
      startPoint,
    );
    return formatResponse(curateResponse(data, DEFAULT_BRANCH_FIELDS));
  },
  delete: async ({ clients, resolvedProject, repository, branch }) => {
    const result = await deleteBranch(
      clients,
      resolvedProject,
      repository,
      branch,
    );
    return formatResponse(result);
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
        project: projectParam(),
        repository: repositoryParam(),
        limit: limitParam(),
        start: startParam(),
      },
      annotations: toolAnnotations(),
    },
    async ({ project, repository, limit = 25, start = 0 }) => {
      const resolvedProject = ctx.resolveProject(project);
      const data = await listBranchRestrictions(
        clients,
        resolvedProject,
        repository,
        { limit, start },
      );
      return formatResponse(
        buildPaginated(data, { restrictions: data.values }),
      );
    },
  );

  server.registerTool(
    "list_branches",
    {
      description:
        "List branches in a repository. Also returns the default branch when available. Supports custom field selection via the `fields` param.",
      inputSchema: {
        project: projectParam(),
        repository: repositoryParam(),
        filterText: z
          .string()
          .optional()
          .describe("Filter branches by name substring."),
        limit: z
          .number()
          .optional()
          .describe("Number of branches to return (default: 25, max: 1000)."),
        start: startParam(),
        fields: fieldsParam(),
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
      const resolvedProject = ctx.resolveProject(project);
      const { branches: branchData, defaultBranch } = await listBranches(
        clients,
        resolvedProject,
        repository,
        { filterText, limit, start },
      );
      const activeFields = fields ?? DEFAULT_BRANCH_FIELDS;
      return formatResponse(
        buildPaginated(branchData, {
          branches: curateList(branchData.values, activeFields),
          defaultBranch: defaultBranch
            ? curateResponse(defaultBranch, activeFields)
            : null,
        }),
      );
    },
  );

  server.registerTool(
    "list_commits",
    {
      description:
        "List commits in a repository, optionally filtered by branch and author. Supports custom field selection via the `fields` param.",
      inputSchema: {
        project: projectParam(),
        repository: repositoryParam(),
        branch: z
          .string()
          .optional()
          .describe("Branch name to list commits from."),
        author: z
          .string()
          .optional()
          .describe(
            "Client-side filter by author (case-insensitive match on name, slug, or displayName).",
          ),
        limit: z
          .number()
          .optional()
          .describe("Number of commits to return (default: 25, max: 1000)."),
        start: startParam(),
        fields: fieldsParam(),
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
      const resolvedProject = ctx.resolveProject(project);
      const data = await listCommits(clients, resolvedProject, repository, {
        branch,
        limit,
        start,
      });

      let commits: Commit[] = data.values as Commit[];
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

      return formatResponse(
        buildPaginated(data, {
          total: author ? commits.length : data.size,
          commits: curateList(commits, fields ?? DEFAULT_COMMIT_FIELDS),
        }),
      );
    },
  );

  server.registerTool(
    "manage_branches",
    {
      description:
        'Manage branches in a repository. Actions: "create" (create a new branch), "delete" (delete a branch). Refuses to delete the default branch.',
      inputSchema: {
        action: z.enum(["create", "delete"]).describe("Operation to perform."),
        project: projectParam(),
        repository: repositoryParam(),
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
      const resolvedProject = ctx.resolveProject(project);
      return await branchActions[action]({
        clients,
        resolvedProject,
        repository,
        branch,
        startPoint,
      });
    },
  );

  server.registerTool(
    "get_commit",
    {
      description:
        "Get details of a specific commit by its ID. Supports custom field selection via the `fields` param.",
      inputSchema: {
        project: projectParam(),
        repository: repositoryParam(),
        commitId: z.string().describe("Full commit hash."),
        fields: fieldsParam(),
      },
      annotations: toolAnnotations(),
    },
    async ({ project, repository, commitId, fields }) => {
      const resolvedProject = ctx.resolveProject(project);
      const data = await getCommit(
        clients,
        resolvedProject,
        repository,
        commitId,
      );
      return formatResponse(
        curateResponse(data, fields ?? DEFAULT_COMMIT_FIELDS),
      );
    },
  );

  server.registerTool(
    "compare_refs",
    {
      description:
        "Compare two refs and list commits accessible from `to` but not from `from`. Supports custom field selection via the `fields` param.",
      inputSchema: {
        project: projectParam(),
        repository: repositoryParam(),
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
        start: startParam(),
        fields: fieldsParam(),
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
      const resolvedProject = ctx.resolveProject(project);
      const data = await compareRefs(clients, resolvedProject, repository, {
        from,
        to,
        limit,
        start,
      });
      return formatResponse(
        buildPaginated(data, {
          commits: curateList(data.values, fields ?? DEFAULT_COMMIT_FIELDS),
        }),
      );
    },
  );
}
