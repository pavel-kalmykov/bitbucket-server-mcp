import type { ApiClients } from "./http/client.js";
import { getPaginated } from "./http/client.js";
import type { Paginated } from "../response/validate.js";

export async function listWebhooks(
  clients: ApiClients,
  project: string,
  repo: string,
  options?: { limit?: number; start?: number },
): Promise<Paginated<Record<string, unknown>>> {
  const { limit = 25, start = 0 } = options ?? {};
  return getPaginated(
    clients.api,
    `projects/${project}/repos/${repo}/webhooks`,
    {
      searchParams: { limit, start },
    },
  );
}

export async function createWebhook(
  clients: ApiClients,
  project: string,
  repo: string,
  body: Record<string, unknown>,
): Promise<Record<string, unknown>> {
  return clients.api
    .post(`projects/${project}/repos/${repo}/webhooks`, { json: body })
    .json<Record<string, unknown>>();
}

export async function updateWebhook(
  clients: ApiClients,
  project: string,
  repo: string,
  webhookId: number,
  body: Record<string, unknown>,
): Promise<Record<string, unknown>> {
  return clients.api
    .put(`projects/${project}/repos/${repo}/webhooks/${webhookId}`, {
      json: body,
    })
    .json<Record<string, unknown>>();
}

export async function deleteWebhook(
  clients: ApiClients,
  project: string,
  repo: string,
  webhookId: number,
): Promise<void> {
  await clients.api.delete(
    `projects/${project}/repos/${repo}/webhooks/${webhookId}`,
  );
}

export async function listRepositoryHooks(
  clients: ApiClients,
  project: string,
  repo: string,
  options?: { limit?: number; start?: number },
): Promise<Paginated<Record<string, unknown>>> {
  const { limit = 25, start = 0 } = options ?? {};
  return getPaginated(
    clients.api,
    `projects/${project}/repos/${repo}/settings/hooks`,
    { searchParams: { limit, start } },
  );
}

export async function enableHook(
  clients: ApiClients,
  project: string,
  repo: string,
  hookKey: string,
): Promise<Record<string, unknown>> {
  return clients.api
    .put(
      `projects/${project}/repos/${repo}/settings/hooks/${hookKey}/enabled`,
      {
        json: {},
      },
    )
    .json<Record<string, unknown>>();
}

export async function disableHook(
  clients: ApiClients,
  project: string,
  repo: string,
  hookKey: string,
): Promise<void> {
  await clients.api.delete(
    `projects/${project}/repos/${repo}/settings/hooks/${hookKey}/enabled`,
  );
}

export async function configureHook(
  clients: ApiClients,
  project: string,
  repo: string,
  hookKey: string,
  settings: Record<string, unknown>,
): Promise<Record<string, unknown>> {
  return clients.api
    .put(
      `projects/${project}/repos/${repo}/settings/hooks/${hookKey}/settings`,
      {
        json: settings,
      },
    )
    .json<Record<string, unknown>>();
}

export async function listMergeChecks(
  clients: ApiClients,
  project: string,
  repo: string,
): Promise<Paginated<Record<string, unknown>>> {
  return getPaginated(
    clients.api,
    `projects/${project}/repos/${repo}/settings/hooks`,
    { searchParams: { type: "PRE_RECEIVE" } },
  );
}

export { configureHook as configureMergeCheck };
