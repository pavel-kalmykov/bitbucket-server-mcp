import type { HttpClients } from "./http/client.js";
import type { ApiCache } from "./http/cache.js";

/**
 * Values a caller configures once and then omits from every call.
 */
export interface ApiDefaults {
  project?: string;
}

/**
 * What an api namespace needs to reach Bitbucket. Built once by
 * `createBitbucketClient` and captured by every namespace factory, so no
 * operation has to thread transport state through its own signature.
 */
export interface ApiContext {
  http: HttpClients;
  cache: ApiCache;
  defaults: ApiDefaults;
}

export function resolveProject(ctx: ApiContext, provided?: string): string {
  const project = provided || ctx.defaults.project;
  if (!project) {
    throw new Error(
      "Project is required. Pass `project` or configure `defaultProject` on the client.",
    );
  }
  return project;
}
