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
  DEFAULT_REPOSITORY_FIELDS,
} from "../response/curate.js";
import type { ToolContext } from "./shared.js";
import {
  projectParam,
  repositoryParam,
  startParam,
  fieldsParam,
} from "./params.js";
import type { ApiClients } from "../api/http/client.js";
import { listForks, forkRepository } from "../api/repositories.js";

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
    if (target_project) body.project = { key: target_project };
    const data = await forkRepository(
      clients,
      resolvedProject,
      repository,
      body,
    );
    return formatResponse(curateResponse(data, DEFAULT_REPOSITORY_FIELDS));
  },
};

export function registerForkTools(ctx: ToolContext) {
  const { server, clients } = ctx;

  server.registerTool(
    "list_forks",
    {
      description:
        "List forks of a repository. Supports custom field selection via the `fields` param.",
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
      const resolvedProject = ctx.resolveProject(project);
      const data = await listForks(clients, resolvedProject, repository, {
        limit,
        start,
      });
      return formatResponse(
        buildPaginated(data, {
          forks: curateList(data.values, fields ?? DEFAULT_REPOSITORY_FIELDS),
        }),
      );
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
      const resolvedProject = ctx.resolveProject(project);
      return await forkActions.fork({
        clients,
        resolvedProject,
        repository,
        name,
        target_project,
      });
    },
  );
}
