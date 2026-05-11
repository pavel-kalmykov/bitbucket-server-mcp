import { z } from "zod";
import { formatResponse } from "../response/format.js";
import { toolAnnotations } from "../response/annotations.js";
import { handleToolError } from "../http/errors.js";
import { getPaginated } from "../http/client.js";
import type { ToolContext } from "./shared.js";
import type { ApiClients } from "../http/client.js";

interface LabelActionContext {
  clients: ApiClients;
  resolvedProject: string;
  repository: string;
  name: string;
}

const labelActions: Record<
  string,
  (ctx: LabelActionContext) => Promise<ReturnType<typeof formatResponse>>
> = {
  add: async ({ clients, resolvedProject, repository, name }) => {
    const data = await clients.api
      .post(`projects/${resolvedProject}/repos/${repository}/labels`, {
        json: { name },
      })
      .json();
    return formatResponse(data);
  },
  remove: async ({ clients, resolvedProject, repository, name }) => {
    await clients.api.delete(
      `projects/${resolvedProject}/repos/${repository}/labels/${name}`,
    );
    return formatResponse({ deleted: true, label: name });
  },
};

export function registerLabelTools(ctx: ToolContext) {
  const { server, clients } = ctx;

  server.registerTool(
    "list_labels",
    {
      description:
        "List labels for a repository. Requires Bitbucket Server 8.5+.",
      inputSchema: {
        project: z
          .string()
          .optional()
          .describe("Project key. Defaults to BITBUCKET_DEFAULT_PROJECT."),
        repository: z.string().describe("Repository slug."),
        limit: z
          .number()
          .optional()
          .describe("Number of labels to return (default: 25)."),
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
          clients.api,
          `projects/${resolvedProject}/repos/${repository}/labels`,
          { searchParams: { limit, start } },
        );

        return formatResponse({
          total: data.size,
          labels: data.values,
          isLastPage: data.isLastPage,
        });
      } catch (error) {
        return handleToolError(error);
      }
    },
  );

  server.registerTool(
    "manage_labels",
    {
      description:
        'Manage repository labels. Actions: "add" (create a new label), "remove" (delete a label). Requires Bitbucket Server 8.5+.',
      inputSchema: {
        action: z.enum(["add", "remove"]).describe("Operation to perform."),
        project: z
          .string()
          .optional()
          .describe("Project key. Defaults to BITBUCKET_DEFAULT_PROJECT."),
        repository: z.string().describe("Repository slug."),
        name: z.string().describe("Label name."),
      },
      annotations: toolAnnotations({
        readOnlyHint: false,
        idempotentHint: false,
      }),
    },
    async ({ action, project, repository, name }) => {
      try {
        const resolvedProject = ctx.resolveProject(project);
        const handler = labelActions[action];
        return await handler({
          clients,
          resolvedProject,
          repository,
          name,
        });
      } catch (error) {
        return handleToolError(error);
      }
    },
  );
}
