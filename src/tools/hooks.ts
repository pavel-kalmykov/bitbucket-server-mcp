import { z } from "zod";
import {
  formatResponse,
  buildPaginated,
  type ToolSuccessResult,
} from "../response/format.js";
import { toolAnnotations } from "../response/annotations.js";
import { getPaginated } from "../core/http/client.js";
import type { ToolContext } from "./shared.js";
import type { ApiClients } from "../core/http/client.js";
import {
  projectParam,
  repositoryParam,
  limitParam,
  startParam,
} from "./params.js";

interface HookActionContext {
  clients: ApiClients;
  resolvedProject: string;
  repository: string;
  hookKey?: string;
  settings?: Record<string, unknown>;
}

const hookActions: Record<
  string,
  (ctx: HookActionContext) => Promise<ToolSuccessResult>
> = {
  enable: async ({ clients, resolvedProject, repository, hookKey }) => {
    await clients.api.put(
      `projects/${resolvedProject}/repos/${repository}/settings/hooks/${hookKey}/settings`,
      { json: {} },
    );
    return formatResponse({ enabled: true, hookKey });
  },
  disable: async ({ clients, resolvedProject, repository, hookKey }) => {
    await clients.api.put(
      `projects/${resolvedProject}/repos/${repository}/settings/hooks/${hookKey}/settings`,
      { json: {} },
    );
    return formatResponse({ enabled: false, hookKey });
  },
  configure: async ({
    clients,
    resolvedProject,
    repository,
    hookKey,
    settings,
  }) => {
    const data = await clients.api
      .put(
        `projects/${resolvedProject}/repos/${repository}/settings/hooks/${hookKey}/settings`,
        { json: settings ?? {} },
      )
      .json();
    return formatResponse(data);
  },
};

export function registerHookTools(ctx: ToolContext) {
  const { server, clients } = ctx;

  server.registerTool(
    "list_repository_hooks",
    {
      description: "List repository hooks and their enabled/disabled state.",
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
      const data = await getPaginated(
        clients.api,
        `projects/${resolvedProject}/repos/${repository}/settings/hooks`,
        { searchParams: { limit, start } },
      );

      return formatResponse(
        buildPaginated(data, {
          hooks: data.values,
        }),
      );
    },
  );

  server.registerTool(
    "manage_repository_hooks",
    {
      description:
        'Manage repository hook settings. Actions: "enable" (enable a hook), "disable" (disable a hook), "configure" (set hook settings).',
      inputSchema: {
        action: z
          .enum(["enable", "disable", "configure"])
          .describe("Operation to perform."),
        project: projectParam(),
        repository: repositoryParam(),
        hookKey: z
          .string()
          .describe(
            "Hook key (e.g. 'com.atlassian.bitbucket.server.bitbucket-bundled-hooks:force-push-hook').",
          ),
        settings: z
          .record(z.string(), z.unknown())
          .optional()
          .describe("Hook settings object (for 'configure' action)."),
      },
      annotations: toolAnnotations({
        readOnlyHint: false,
        idempotentHint: false,
      }),
    },
    async ({ action, project, repository, hookKey, settings }) => {
      const resolvedProject = ctx.resolveProject(project);
      const handler = hookActions[action];
      return await handler({
        clients,
        resolvedProject,
        repository,
        hookKey,
        settings,
      });
    },
  );
}
