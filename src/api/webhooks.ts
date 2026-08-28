import type { ApiContext } from "./context.js";
import { resolveProject } from "./context.js";
import { getPaginated } from "./http/client.js";
import type { Paginated } from "./http/pagination.js";

export interface ListWebhooksParams {
  project?: string;
  repository: string;
  limit?: number;
  start?: number;
}

export interface CreateWebhookParams {
  project?: string;
  repository: string;
  name?: string;
  url?: string;
  events?: string[];
  active?: boolean;
}

export interface UpdateWebhookParams extends CreateWebhookParams {
  webhookId?: number;
}

export interface DeleteWebhookParams {
  project?: string;
  repository: string;
  webhookId?: number;
}

export function webhooksApi(ctx: ApiContext) {
  const path = (project: string | undefined, repository: string) =>
    `projects/${resolveProject(ctx, project)}/repos/${repository}/webhooks`;

  return {
    async list({
      project,
      repository,
      limit = 25,
      start = 0,
    }: ListWebhooksParams): Promise<Paginated<Record<string, unknown>>> {
      return getPaginated(ctx.http.api, path(project, repository), {
        searchParams: { limit, start },
      });
    },

    async create({
      project,
      repository,
      name,
      url,
      events,
      active,
    }: CreateWebhookParams): Promise<unknown> {
      const json: Record<string, unknown> = { name, url, events };
      if (active !== undefined) json.active = active;

      return ctx.http.api.post(path(project, repository), { json }).json();
    },

    async update({
      project,
      repository,
      webhookId,
      name,
      url,
      events,
      active,
    }: UpdateWebhookParams): Promise<unknown> {
      const json: Record<string, unknown> = {};
      if (name !== undefined) json.name = name;
      if (url !== undefined) json.url = url;
      if (events !== undefined) json.events = events;
      if (active !== undefined) json.active = active;

      return ctx.http.api
        .put(`${path(project, repository)}/${webhookId}`, { json })
        .json();
    },

    async delete({
      project,
      repository,
      webhookId,
    }: DeleteWebhookParams): Promise<{ deleted: true; webhookId?: number }> {
      await ctx.http.api.delete(`${path(project, repository)}/${webhookId}`);
      return { deleted: true, webhookId };
    },
  };
}

export type WebhooksApi = ReturnType<typeof webhooksApi>;
