import {
  createHttpClients,
  type HttpClientOptions,
  type HttpClients,
} from "./http/client.js";
import { ApiCache } from "./http/cache.js";
import type { ApiContext, ApiDefaults } from "./context.js";
import { branchesApi, type BranchesApi } from "./branches.js";
import { buildStatusApi, type BuildStatusApi } from "./build-status.js";
import { commentsApi, type CommentsApi } from "./comments.js";
import {
  commitCommentsApi,
  type CommitCommentsApi,
} from "./commit-comments.js";
import { commitsApi, type CommitsApi } from "./commits.js";
import { deploymentsApi, type DeploymentsApi } from "./deployments.js";
import {
  defaultReviewersApi,
  type DefaultReviewersApi,
} from "./default-reviewers.js";
import { emoticonsApi, type EmoticonsApi } from "./emoticons.js";
import { forksApi, type ForksApi } from "./forks.js";
import { hooksApi, type HooksApi } from "./hooks.js";
import {
  sshKeysApi,
  gpgKeysApi,
  type SshKeysApi,
  type GpgKeysApi,
} from "./keys.js";
import { insightsApi, type InsightsApi } from "./insights.js";
import { labelsApi, type LabelsApi } from "./labels.js";
import { mergeChecksApi, type MergeChecksApi } from "./merge-checks.js";
import {
  reviewerGroupsApi,
  type ReviewerGroupsApi,
} from "./reviewer-groups.js";
import { projectsApi, type ProjectsApi } from "./projects.js";
import { pullRequestsApi, type PullRequestsApi } from "./pull-requests.js";
import { repositoriesApi, type RepositoriesApi } from "./repositories.js";
import { searchApi, type SearchApi } from "./search.js";
import { webhooksApi, type WebhooksApi } from "./webhooks.js";
import {
  secretScanningApi,
  type SecretScanningApi,
} from "./secret-scanning.js";
import { serverApi, type ServerApi } from "./server-info.js";
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
  readonly buildStatus: BuildStatusApi;
  readonly comments: CommentsApi;
  readonly commitComments: CommitCommentsApi;
  readonly commits: CommitsApi;
  readonly defaultReviewers: DefaultReviewersApi;
  readonly deployments: DeploymentsApi;
  readonly emoticons: EmoticonsApi;
  readonly forks: ForksApi;
  readonly gpgKeys: GpgKeysApi;
  readonly hooks: HooksApi;
  readonly insights: InsightsApi;
  readonly labels: LabelsApi;
  readonly mergeChecks: MergeChecksApi;
  readonly projects: ProjectsApi;
  readonly pullRequests: PullRequestsApi;
  readonly repositories: RepositoriesApi;
  readonly reviewerGroups: ReviewerGroupsApi;
  readonly search: SearchApi;
  readonly secretScanning: SecretScanningApi;
  readonly server: ServerApi;
  readonly sshKeys: SshKeysApi;
  readonly tags: TagsApi;
  readonly webhooks: WebhooksApi;
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
    buildStatus: buildStatusApi(context),
    comments: commentsApi(context),
    commitComments: commitCommentsApi(context),
    commits: commitsApi(context),
    deployments: deploymentsApi(context),
    defaultReviewers: defaultReviewersApi(context),
    emoticons: emoticonsApi(context),
    forks: forksApi(context),
    hooks: hooksApi(context),
    gpgKeys: gpgKeysApi(context),
    insights: insightsApi(context),
    labels: labelsApi(context),
    mergeChecks: mergeChecksApi(context),
    projects: projectsApi(context),
    pullRequests: pullRequestsApi(context),
    repositories: repositoriesApi(context),
    reviewerGroups: reviewerGroupsApi(context),
    search: searchApi(context),
    secretScanning: secretScanningApi(context),
    server: serverApi(context),
    sshKeys: sshKeysApi(context),
    tags: tagsApi(context),
    webhooks: webhooksApi(context),
    users: usersApi(context),
  };
}
