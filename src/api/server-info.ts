import type { ApiContext } from "./context.js";

export function serverApi(ctx: ApiContext) {
  return {
    async info(): Promise<unknown> {
      return ctx.http.api.get("application-properties").json();
    },
  };
}

export type ServerApi = ReturnType<typeof serverApi>;
