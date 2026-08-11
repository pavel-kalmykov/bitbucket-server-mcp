import type { ApiClients } from "./http/client.js";
import type { Paginated } from "../response/validate.js";
import { getPaginated } from "./http/client.js";
export async function listSshKeys(
  c: ApiClients,
  o?: { userSlug?: string; limit?: number; start?: number },
): Promise<Paginated<Record<string, unknown>>> {
  const { userSlug, limit = 25, start = 0 } = o ?? {};
  const sp: Record<string, string | number> = { limit, start };
  if (userSlug) sp.user = userSlug;
  return getPaginated(c.ssh, "keys", { searchParams: sp });
}
export async function listGpgKeys(
  c: ApiClients,
  o?: { userSlug?: string; limit?: number; start?: number },
): Promise<Paginated<Record<string, unknown>>> {
  const { userSlug, limit = 25, start = 0 } = o ?? {};
  const sp: Record<string, string | number> = { limit, start };
  if (userSlug) sp.user = userSlug;
  return getPaginated(c.gpg, "keys", { searchParams: sp });
}
