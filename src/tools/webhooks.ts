import { z } from "zod";
import {
  formatResponse,
  buildPaginated,
  type ToolSuccessResult,
} from "../response/format.js";
import { toolAnnotations } from "../response/annotations.js";
import type { ToolContext } from "./shared.js";
import {
  projectParam,
  repositoryParam,
  limitParam,
  startParam,
  fieldsParam,
} from "./params.js";
import { curateList, DEFAULT_WEBHOOK_FIELDS } from "../response/curate.js";

const actionParam = z
  .enum(["create", "update", "delete"])
  .describe("Operation to perform.");
type WebhookAction = z.infer<typeof actionParam>;

export function registerWebhookTools(ctx: ToolContext) {
  const { server, bb } = ctx;

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
    async ({ fields, ...params }) => {
      const data = await bb.webhooks.list(params);

      return formatResponse(
        buildPaginated(data, {
          webhooks: curateList(data.values, fields ?? DEFAULT_WEBHOOK_FIELDS),
        }),
      );
    },
  );

  server.registerTool(
    "manage_webhooks",
    {
      description:
        'Manage repository webhooks. Actions: "create" (add a new webhook), "update" (modify an existing webhook), "delete" (remove a webhook).',
      inputSchema: {
        action: actionParam,
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
    async ({ action, ...params }) => {
      const run: Record<WebhookAction, () => Promise<ToolSuccessResult>> = {
        create: async () => formatResponse(await bb.webhooks.create(params)),
        update: async () => formatResponse(await bb.webhooks.update(params)),
        delete: async () => formatResponse(await bb.webhooks.delete(params)),
      };

      return run[action]();
    },
  );
}
