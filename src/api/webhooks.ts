import type { ApiClients } from "./http/client.js";
import { getPaginated } from "./http/client.js";
import type { Paginated } from "../response/validate.js";

export async function listWebhooks(
  clients: ApiClients,
  project: string,
  repository: string,
  options?: { limit?: number; start?: number },
): Promise<Paginated<Record<string, unknown>>> {
  const { limit = 25, start = 0 } = options ?? {};
  return getPaginated(
    clients.api,
    `projects/${project}/repos/${repository}/webhooks`,
    {
      searchParams: { limit, start },
    },
  );
}

export async function createWebhook(
  clients: ApiClients,
  project: string,
  repository: string,
  body: Record<string, unknown>,
): Promise<Record<string, unknown>> {
  return clients.api
    .post(`projects/${project}/repos/${repository}/webhooks`, { json: body })
    .json<Record<string, unknown>>();
}

export async function updateWebhook(
  clients: ApiClients,
  project: string,
  repository: string,
  webhookId: number,
  body: Record<string, unknown>,
): Promise<Record<string, unknown>> {
  return clients.api
    .put(`projects/${project}/repos/${repository}/webhooks/${webhookId}`, {
      json: body,
    })
    .json<Record<string, unknown>>();
}

export async function deleteWebhook(
  clients: ApiClients,
  project: string,
  repository: string,
  webhookId: number,
): Promise<void> {
  await clients.api.delete(
    `projects/${project}/repos/${repository}/webhooks/${webhookId}`,
  );
}

export async function listRepositoryHooks(
  clients: ApiClients,
  project: string,
  repository: string,
  options?: { limit?: number; start?: number },
): Promise<Paginated<Record<string, unknown>>> {
  const { limit = 25, start = 0 } = options ?? {};
  return getPaginated(
    clients.api,
    `projects/${project}/repos/${repository}/settings/hooks`,
    { searchParams: { limit, start } },
  );
}

export async function configureHook(
  clients: ApiClients,
  project: string,
  repository: string,
  hookKey: string,
  settings: Record<string, unknown>,
): Promise<Record<string, unknown>> {
  return clients.api
    .put(
      `projects/${project}/repos/${repository}/settings/hooks/${hookKey}/settings`,
      { json: settings },
    )
    .json<Record<string, unknown>>();
}

export async function listMergeChecks(
  clients: ApiClients,
  project: string,
  repository: string,
): Promise<Array<Record<string, unknown>>> {
  const hooks = await clients.api
    .get(`projects/${project}/repos/${repository}/settings/hooks`)
    .json<{
      values: Array<{
        key: string;
        enabled: boolean;
        details?: { name?: string; description?: string; type?: string };
      }>;
    }>();

  const mergeCheckHooks = hooks.values.filter(
    (h) => h.details?.type === "PRE_PULL_REQUEST_MERGE",
  );

  return Promise.all(
    mergeCheckHooks.map(async (hook) => {
      const settings = await clients.api
        .get(
          `projects/${project}/repos/${repository}/settings/hooks/${hook.key}/settings`,
        )
        .json<Record<string, unknown>>()
        .catch(() => ({}));
      return {
        key: hook.key,
        name: hook.details?.name,
        description: hook.details?.description,
        enabled: hook.enabled,
        settings,
      };
    }),
  );
}
