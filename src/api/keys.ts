import type { ApiContext } from "./context.js";
import type { KyInstance } from "ky";

export interface ListKeysParams {
  userSlug?: string;
  limit?: number;
  start?: number;
}

export interface AddKeyParams {
  text: string;
}

export interface DeleteKeyParams {
  keyId: number;
}

export interface KeyPage {
  values: unknown[];
  size: number;
  isLastPage: boolean;
}

function keysApi(client: KyInstance) {
  return {
    async list({
      userSlug,
      limit = 25,
      start = 0,
    }: ListKeysParams): Promise<KeyPage> {
      const searchParams: Record<string, string | number> = { limit, start };
      if (userSlug) searchParams.user = userSlug;

      return client.get("keys", { searchParams }).json<KeyPage>();
    },

    async add({ text }: AddKeyParams): Promise<unknown> {
      return client.post("keys", { json: { text } }).json();
    },

    async delete({
      keyId,
    }: DeleteKeyParams): Promise<{ deleted: true; keyId: number }> {
      await client.delete(`keys/${keyId}`);
      return { deleted: true, keyId };
    },
  };
}

export function sshKeysApi(ctx: ApiContext) {
  return keysApi(ctx.http.ssh);
}

export function gpgKeysApi(ctx: ApiContext) {
  return keysApi(ctx.http.gpg);
}

export type SshKeysApi = ReturnType<typeof sshKeysApi>;
export type GpgKeysApi = ReturnType<typeof gpgKeysApi>;
