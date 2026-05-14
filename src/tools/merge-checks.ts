import { z } from "zod";
import { formatResponse } from "../response/format.js";
import { toolAnnotations } from "../response/annotations.js";
import { handleToolError } from "../http/errors.js";
import type { ToolContext } from "./shared.js";

export function registerMergeCheckTools(ctx: ToolContext) {
  const { server, clients } = ctx;

  server.registerTool(
    "list_merge_checks",
    {
      description:
        "List merge check configurations for a repository. Merge checks control conditions that must be met before a pull request can be merged.",
      inputSchema: {
        project: z
          .string()
          .optional()
          .describe("Project key. Defaults to BITBUCKET_DEFAULT_PROJECT."),
        repository: z.string().describe("Repository slug."),
      },
      annotations: toolAnnotations(),
    },
    async ({ project, repository }) => {
      try {
        const resolvedProject = ctx.resolveProject(project);
        const hooks = await clients.api
          .get(`projects/${resolvedProject}/repos/${repository}/settings/hooks`)
          .json<{
            values: Array<{
              key: string;
              enabled: boolean;
              details?: { name: string };
            }>;
          }>();

        const mergeCheckKeys = ["merge", "requiredBuilds"];
        const mergeCheckHooks = hooks.values.filter((h) =>
          mergeCheckKeys.some((k) => h.key.toLowerCase().includes(k)),
        );

        const checks = await Promise.all(
          mergeCheckHooks.map(async (hook) => {
            const settings = await clients.api
              .get(
                `projects/${resolvedProject}/repos/${repository}/settings/hooks/${hook.key}/settings`,
              )
              .json<Record<string, unknown>>()
              .catch(() => ({}));
            return { key: hook.key, enabled: hook.enabled, settings };
          }),
        );

        return formatResponse(checks);
      } catch (error) {
        return handleToolError(error);
      }
    },
  );

  server.registerTool(
    "manage_merge_checks",
    {
      description: "Configure merge check settings for a repository.",
      inputSchema: {
        project: z
          .string()
          .optional()
          .describe("Project key. Defaults to BITBUCKET_DEFAULT_PROJECT."),
        repository: z.string().describe("Repository slug."),
        hookKey: z.string().describe("Merge check hook key."),
        settings: z
          .record(z.string(), z.unknown())
          .describe("Hook settings object."),
      },
      annotations: toolAnnotations({
        readOnlyHint: false,
        idempotentHint: false,
      }),
    },
    async ({ project, repository, hookKey, settings }) => {
      try {
        const resolvedProject = ctx.resolveProject(project);
        const data = await clients.api
          .put(
            `projects/${resolvedProject}/repos/${repository}/settings/hooks/${hookKey}/settings`,
            { json: settings },
          )
          .json();

        return formatResponse(data);
      } catch (error) {
        return handleToolError(error);
      }
    },
  );
}
