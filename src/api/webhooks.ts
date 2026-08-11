import type { ApiClients } from "./http/client.js";
import { getPaginated } from "./http/client.js";
import type { Paginated } from "../response/validate.js";
export async function listWebhooks(
  c: ApiClients,
  p: string,
  r: string,
  o?: { limit?: number; start?: number },
): Promise<Paginated<Record<string, unknown>>> {
  const { limit = 25, start = 0 } = o ?? {};
  return getPaginated(c.api, `projects/${p}/repos/${r}/webhooks`, {
    searchParams: { limit, start },
  });
}
export async function listRepositoryHooks(
  c: ApiClients,
  p: string,
  r: string,
  o?: { limit?: number; start?: number },
): Promise<Paginated<Record<string, unknown>>> {
  const { limit = 25, start = 0 } = o ?? {};
  return getPaginated(c.api, `projects/${p}/repos/${r}/settings/hooks`, {
    searchParams: { limit, start },
  });
}
