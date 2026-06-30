import { z } from "zod";
import { formatResponse, type ToolSuccessResult } from "../response/format.js";
import { toolAnnotations } from "../response/annotations.js";
import { handleToolError } from "../http/errors.js";
import { getPaginated } from "../http/client.js";
import type { ToolContext } from "./shared.js";
import type { ApiClients } from "../http/client.js";
import {
  projectParam,
  repositoryParam,
  limitParam,
  startParam,
  fieldsParam,
} from "./params.js";
import { curateList, DEFAULT_WEBHOOK_FIELDS } from "../response/curate.js";

interface WebhookActionContext {
  clients: ApiClients;
  resolvedProject: string;
  repository: string;
  name?: string;
  url?: string;
  events?: string[];
  active?: boolean;
  webhookId?: number;
}

const webhookActions: Record<
  string,
  (ctx: WebhookActionContext) => Promise<ToolSuccessResult>
> = {
  create: async ({
    clients,
    resolvedProject,
    repository,
    name,
    url,
    events,
    active,
  }) => {
    const body: Record<string, unknown> = { name, url, events };
    if (active !== undefined) body.active = active;
    const data = await clients.api
      .post(`projects/${resolvedProject}/repos/${repository}/webhooks`, {
        json: body,
      })
      .json();
    return formatResponse(data);
  },
  update: async ({
    clients,
    resolvedProject,
    repository,
    webhookId,
    name,
    url,
    events,
    active,
  }) => {
    const body: Record<string, unknown> = {};
    if (name !== undefined) body.name = name;
    if (url !== undefined) body.url = url;
    if (events !== undefined) body.events = events;
    if (active !== undefined) body.active = active;
    const data = await clients.api
      .put(
        `projects/${resolvedProject}/repos/${repository}/webhooks/${webhookId}`,
        { json: body },
      )
      .json();
    return formatResponse(data);
  },
  delete: async ({ clients, resolvedProject, repository, webhookId }) => {
    await clients.api.delete(
      `projects/${resolvedProject}/repos/${repository}/webhooks/${webhookId}`,
    );
    return formatResponse({ deleted: true, webhookId });
  },
};

export function registerWebhookTools(ctx: ToolContext) {
  const { server, clients } = ctx;

  server.registerTool(
    "list_webhooks",
    {
      description: "List webhooks configured for a repository.",
      inputSchema: {
        project: projectParam(),
        repository: repositoryParam(),
        limit: limitParam(),
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
          `projects/${resolvedProject}/repos/${repository}/webhooks`,
          { searchParams: { limit, start } },
        );

        return formatResponse({
          total: data.size,
          webhooks: curateList(data.values, fields ?? DEFAULT_WEBHOOK_FIELDS),
          isLastPage: data.isLastPage,
        });
      } catch (error) {
        return handleToolError(error);
      }
    },
  );

  server.registerTool(
    "manage_webhooks",
    {
      description:
        'Manage repository webhooks. Actions: "create" (add a new webhook), "update" (modify an existing webhook), "delete" (remove a webhook).',
      inputSchema: {
        action: z
          .enum(["create", "update", "delete"])
          .describe("Operation to perform."),
        project: projectParam(),
        repository: repositoryParam(),
        webhookId: z
          .number()
          .optional()
          .describe("Webhook ID (required for update and delete)."),
        name: z
          .string()
          .optional()
          .describe("Webhook name (required for create)."),
        url: z
          .string()
          .optional()
          .describe("Webhook callback URL (required for create)."),
        events: z
          .array(z.string())
          .optional()
          .describe(
            "List of event types to subscribe to (e.g. 'repo:refs_changed', 'pr:opened').",
          ),
        active: z
          .boolean()
          .optional()
          .describe("Whether the webhook is active (default: true)."),
      },
      annotations: toolAnnotations({
        readOnlyHint: false,
        idempotentHint: false,
      }),
    },
    async ({
      action,
      project,
      repository,
      webhookId,
      name,
      url,
      events,
      active,
    }) => {
      try {
        const resolvedProject = ctx.resolveProject(project);
        const handler = webhookActions[action];
        return await handler({
          clients,
          resolvedProject,
          repository,
          webhookId,
          name,
          url,
          events,
          active,
        });
      } catch (error) {
        return handleToolError(error);
      }
    },
  );
}
