import { z } from "zod";
import { formatResponse, type ToolSuccessResult } from "../response/format.js";
import { toolAnnotations } from "../response/annotations.js";
import { handleToolError } from "../http/errors.js";
import { curateList, DEFAULT_REPOSITORY_FIELDS } from "../response/curate.js";
import { getPaginated } from "../http/client.js";
import type { ToolContext } from "./shared.js";
import {
  projectParam,
  repositoryParam,
  startParam,
  fieldsParam,
} from "./params.js";
import type { ApiClients } from "../http/client.js";

interface ForkActionContext {
  clients: ApiClients;
  resolvedProject: string;
  repository: string;
  name?: string;
  target_project?: string;
}

const forkActions: Record<
  string,
  (ctx: ForkActionContext) => Promise<ToolSuccessResult>
> = {
  fork: async ({
    clients,
    resolvedProject,
    repository,
    name,
    target_project,
  }) => {
    const body: Record<string, unknown> = {};
    if (name) body.name = name;
    if (target_project) {
      body.project = { key: target_project };
    }
    const data = await clients.api
      .post(`projects/${resolvedProject}/repos/${repository}`, { json: body })
      .json();
    return formatResponse(data);
  },
};

export function registerForkTools(ctx: ToolContext) {
  const { server, clients } = ctx;

  server.registerTool(
    "list_forks",
    {
      description:
        "List forks of a repository. Supports custom field selection via the `fields` param (`'*all'` for full raw response, `'slug,name'` for a custom subset).",
      inputSchema: {
        project: projectParam(),
        repository: repositoryParam(),
        limit: z
          .number()
          .optional()
          .describe("Number of forks to return (default: 25, max: 1000)."),
        start: startParam(),
        fields: fieldsParam(),
      },
      annotations: toolAnnotations(),
    },
    async ({ project, repository, limit = 25, start = 0, fields }) => {
      try {
        const resolvedProject = ctx.resolveProject(project);
        const data = await getPaginated(
          clients.api,
          `projects/${resolvedProject}/repos/${repository}/forks`,
          { searchParams: { limit, start } },
        );

        return formatResponse({
          total: data.size,
          forks: curateList(data.values, fields ?? DEFAULT_REPOSITORY_FIELDS),
          isLastPage: data.isLastPage,
        });
      } catch (error) {
        return handleToolError(error);
      }
    },
  );

  server.registerTool(
    "fork_repository",
    {
      description:
        "Fork a repository into a target project. Creates a copy of the source repository in the specified target project.",
      inputSchema: {
        project: z
          .string()
          .optional()
          .describe(
            "Source project key. Defaults to BITBUCKET_DEFAULT_PROJECT.",
          ),
        repository: z.string().describe("Source repository slug."),
        name: z
          .string()
          .optional()
          .describe(
            "Name for the forked repository. Defaults to the source repository name.",
          ),
        target_project: z
          .string()
          .optional()
          .describe(
            "Target project key where the fork will be created. Defaults to the user's personal project.",
          ),
      },
      annotations: toolAnnotations({
        readOnlyHint: false,
        idempotentHint: false,
      }),
    },
    async ({ project, repository, name, target_project }) => {
      try {
        const resolvedProject = ctx.resolveProject(project);
        const handler = forkActions.fork;
        return await handler({
          clients,
          resolvedProject,
          repository,
          name,
          target_project,
        });
      } catch (error) {
        return handleToolError(error);
      }
    },
  );
}
