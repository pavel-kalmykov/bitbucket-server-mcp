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
import {
  projectParam,
  repositoryParam,
  limitParam,
  startParam,
  fieldsParam,
} from "./params.js";

const actionParam = z
  .enum(["create", "delete"])
  .describe("Operation to perform.");
type BranchAction = z.infer<typeof actionParam>;

export function registerBranchTools(ctx: ToolContext) {
  const { server, bb } = ctx;

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
    async (params) => {
      const data = await bb.branches.listRestrictions(params);

      return formatResponse(
        buildPaginated(data, { restrictions: data.values }),
      );
    },
  );

  server.registerTool(
    "list_branches",
    {
      description:
        "List branches in a repository. Also returns the default branch when available. Supports custom field selection via the `fields` param (`'*all'` for full raw response, `'displayId,latestCommit'` for a custom subset).",
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
    async ({ fields, ...params }) => {
      const { branches, defaultBranch } = await bb.branches.list(params);
      const activeFields = fields ?? DEFAULT_BRANCH_FIELDS;

      return formatResponse(
        buildPaginated(branches, {
          branches: curateList(branches.values, activeFields),
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
        "List commits in a repository, optionally filtered by branch and author. Supports custom field selection via the `fields` param (`'*all'` for full raw response, `'id,message,author.name'` for a custom subset).",
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
            "Client-side filter by author (case-insensitive match on name, slug, or displayName). Only filters the current page of results. Use with start/limit to paginate for more matches.",
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
    async ({ fields, ...params }) => {
      const data = await bb.commits.list(params);

      return formatResponse(
        buildPaginated(data, {
          commits: curateList(data.values, fields ?? DEFAULT_COMMIT_FIELDS),
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
        action: actionParam,
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
    async ({ action, ...params }) => {
      const run: Record<BranchAction, () => Promise<ToolSuccessResult>> = {
        create: async () =>
          formatResponse(
            curateResponse(
              await bb.branches.create(params),
              DEFAULT_BRANCH_FIELDS,
            ),
          ),
        delete: async () => formatResponse(await bb.branches.delete(params)),
      };

      return run[action]();
    },
  );

  server.registerTool(
    "get_commit",
    {
      description:
        "Get details of a specific commit by its ID. Supports custom field selection via the `fields` param (`'*all'` for full raw response, `'id,message,author.name'` for a custom subset).",
      inputSchema: {
        project: projectParam(),
        repository: repositoryParam(),
        commitId: z.string().describe("Full commit hash."),
        fields: fieldsParam(),
      },
      annotations: toolAnnotations(),
    },
    async ({ fields, ...params }) => {
      const data = await bb.commits.get(params);

      return formatResponse(
        curateResponse(data, fields ?? DEFAULT_COMMIT_FIELDS),
      );
    },
  );

  server.registerTool(
    "compare_refs",
    {
      description:
        "Compare two refs and list commits accessible from `to` but not from `from`. Supports custom field selection via the `fields` param (`'*all'` for full raw response, `'id,message,author.name'` for a custom subset).",
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
    async ({ fields, ...params }) => {
      const data = await bb.commits.compare(params);

      return formatResponse(
        buildPaginated(data, {
          commits: curateList(data.values, fields ?? DEFAULT_COMMIT_FIELDS),
        }),
      );
    },
  );
}
