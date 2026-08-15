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
import { listRepositoryHooks, configureHook } from "../api/webhooks.js";

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
    await configureHook(clients, resolvedProject, repository, hookKey!, {});
    return formatResponse({ enabled: true, hookKey });
  },
  disable: async ({ clients, resolvedProject, repository, hookKey }) => {
    await configureHook(clients, resolvedProject, repository, hookKey!, {});
    return formatResponse({ enabled: false, hookKey });
  },
  configure: async ({
    clients,
    resolvedProject,
    repository,
    hookKey,
    settings,
  }) => {
    const data = await configureHook(
      clients,
      resolvedProject,
      repository,
      hookKey!,
      settings ?? {},
    );
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
      const data = await listRepositoryHooks(
        clients,
        resolvedProject,
        repository,
        {
          limit,
          start,
        },
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
      return await hookActions[action]({
        clients,
        resolvedProject,
        repository,
        hookKey,
        settings,
      });
    },
  );
}
