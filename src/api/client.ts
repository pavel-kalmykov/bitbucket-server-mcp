import {
  createHttpClients,
  type HttpClientOptions,
  type HttpClients,
} from "./http/client.js";
import { ApiCache } from "./http/cache.js";
import type { ApiContext, ApiDefaults } from "./context.js";
import { branchesApi, type BranchesApi } from "./branches.js";
import { commitsApi, type CommitsApi } from "./commits.js";
import { tagsApi, type TagsApi } from "./tags.js";
import { usersApi, type UsersApi } from "./users.js";

const DEFAULT_CACHE_TTL_MS = 5 * 60 * 1000;

export interface BitbucketClientOptions extends HttpClientOptions {
  /** Project key used whenever an operation omits `project`. */
  defaultProject?: string;
  /** How long cached reads stay fresh. Defaults to 5 minutes. */
  cacheTtlMs?: number;
  /** Transport seam. Defaults to ky instances built from these options. */
  http?: HttpClients;
  /** Cache seam. Defaults to a fresh cache using `cacheTtlMs`. */
  cache?: ApiCache;
}

/**
 * Entry point to the Bitbucket Server REST API. Credentials and defaults are
 * bound once; operations are grouped into namespaces and take a single params
 * object.
 */
export interface BitbucketClient {
  readonly http: HttpClients;
  readonly cache: ApiCache;
  readonly defaults: ApiDefaults;
  readonly branches: BranchesApi;
  readonly commits: CommitsApi;
  readonly tags: TagsApi;
  readonly users: UsersApi;
}

export function createBitbucketClient(
  options: BitbucketClientOptions,
): BitbucketClient {
  const context: ApiContext = {
    http: options.http ?? createHttpClients(options),
    cache:
      options.cache ??
      new ApiCache({
        defaultTtlMs: options.cacheTtlMs ?? DEFAULT_CACHE_TTL_MS,
      }),
    defaults: { project: options.defaultProject },
  };

  return {
    http: context.http,
    cache: context.cache,
    defaults: context.defaults,
    branches: branchesApi(context),
    commits: commitsApi(context),
    tags: tagsApi(context),
    users: usersApi(context),
  };
}
