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
} from "./params.js";
import { listLabels, addLabel, removeLabel } from "../api/repositories.js";

interface LabelActionContext {
  clients: ApiClients;
  resolvedProject: string;
  repository: string;
  name: string;
}

const labelActions: Record<
  string,
  (ctx: LabelActionContext) => Promise<ToolSuccessResult>
> = {
  add: async ({ clients, resolvedProject, repository, name }) => {
    const data = await addLabel(clients, resolvedProject, repository, name);
    return formatResponse(data);
  },
  remove: async ({ clients, resolvedProject, repository, name }) => {
    await removeLabel(clients, resolvedProject, repository, name);
    return formatResponse({ deleted: true, label: name });
  },
};

export function registerLabelTools(ctx: ToolContext) {
  const { server, clients } = ctx;

  server.registerTool(
    "list_labels",
    {
      description: "List labels for a repository.",
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
      const data = await listLabels(clients, resolvedProject, repository, {
        limit,
        start,
      });
      return formatResponse(
        buildPaginated(data, {
          labels: data.values,
        }),
      );
    },
  );

  server.registerTool(
    "manage_labels",
    {
      description:
        'Manage repository labels. Actions: "add" (create a new label), "remove" (delete a label).',
      inputSchema: {
        action: z.enum(["add", "remove"]).describe("Operation to perform."),
        project: projectParam(),
        repository: repositoryParam(),
        name: z.string().describe("Label name."),
      },
      annotations: toolAnnotations({
        readOnlyHint: false,
        idempotentHint: false,
      }),
    },
    async ({ action, project, repository, name }) => {
      const resolvedProject = ctx.resolveProject(project);
      return await labelActions[action]({
        clients,
        resolvedProject,
        repository,
        name,
      });
    },
  );
}
