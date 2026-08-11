import type { ApiClients } from "./http/client.js";
import type { Paginated } from "../response/validate.js";
import { getPaginated } from "./http/client.js";

export async function listSshKeys(
  clients: ApiClients,
  options?: { userSlug?: string; limit?: number; start?: number },
): Promise<Paginated<Record<string, unknown>>> {
  const { userSlug, limit = 25, start = 0 } = options ?? {};
  const searchParams: Record<string, string | number> = { limit, start };
  if (userSlug) searchParams.user = userSlug;
  return getPaginated(clients.ssh, "keys", { searchParams });
}

export async function addSshKey(
  clients: ApiClients,
  text: string,
): Promise<Record<string, unknown>> {
  return clients.ssh
    .post("keys", { json: { text } })
    .json<Record<string, unknown>>();
}

export async function deleteSshKey(
  clients: ApiClients,
  keyId: number,
): Promise<void> {
  await clients.ssh.delete(`keys/${keyId}`);
}

export async function listGpgKeys(
  clients: ApiClients,
  options?: { userSlug?: string; limit?: number; start?: number },
): Promise<Paginated<Record<string, unknown>>> {
  const { userSlug, limit = 25, start = 0 } = options ?? {};
  const searchParams: Record<string, string | number> = { limit, start };
  if (userSlug) searchParams.user = userSlug;
  return getPaginated(clients.gpg, "keys", { searchParams });
}

export async function addGpgKey(
  clients: ApiClients,
  text: string,
): Promise<Record<string, unknown>> {
  return clients.gpg
    .post("keys", { json: { text } })
    .json<Record<string, unknown>>();
}

export async function deleteGpgKey(
  clients: ApiClients,
  keyId: number,
): Promise<void> {
  await clients.gpg.delete(`keys/${keyId}`);
}
