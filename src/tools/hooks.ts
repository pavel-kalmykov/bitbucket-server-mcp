import { z } from "zod";
import { formatResponse } from "../response/format.js";
import { toolAnnotations } from "../response/annotations.js";
import { handleToolError } from "../http/errors.js";
import { getPaginated } from "../http/client.js";
import type { ToolContext } from "./shared.js";
import type { ApiClients } from "../http/client.js";

interface HookActionContext {
  clients: ApiClients;
  resolvedProject: string;
  repository: string;
  hookKey?: string;
  settings?: Record<string, unknown>;
}

const hookActions: Record<
  string,
  (ctx: HookActionContext) => Promise<ReturnType<typeof formatResponse>>
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
        project: z
          .string()
          .optional()
          .describe("Project key. Defaults to BITBUCKET_DEFAULT_PROJECT."),
        repository: z.string().describe("Repository slug."),
        limit: z
          .number()
          .optional()
          .describe("Number of hooks to return (default: 25)."),
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
          `projects/${resolvedProject}/repos/${repository}/settings/hooks`,
          { searchParams: { limit, start } },
        );

        return formatResponse({
          total: data.size,
          hooks: data.values,
          isLastPage: data.isLastPage,
        });
      } catch (error) {
        return handleToolError(error);
      }
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
        project: z
          .string()
          .optional()
          .describe("Project key. Defaults to BITBUCKET_DEFAULT_PROJECT."),
        repository: z.string().describe("Repository slug."),
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
      try {
        const resolvedProject = ctx.resolveProject(project);
        const handler = hookActions[action];
        return await handler({
          clients,
          resolvedProject,
          repository,
          hookKey,
          settings,
        });
      } catch (error) {
        return handleToolError(error);
      }
    },
  );
}
