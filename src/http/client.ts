import ky, { type KyInstance, type Options } from "ky";
import type { BitbucketConfig } from "../types.js";
import { logger } from "../logging.js";
import { validatePaginated, type Paginated } from "../response/validate.js";

export interface ApiClients {
  api: KyInstance;
  buildStatus: KyInstance;
  commentLikes: KyInstance;
  emoticons: KyInstance;
  insights: KyInstance;
  search: KyInstance;
  branchUtils: KyInstance;
  defaultReviewers: KyInstance;
  git: KyInstance;
  ui: KyInstance;
  ssh: KyInstance;
  gpg: KyInstance;
}

// Build a redactor from the actual credential values in config so that any
// of those values appearing in a logged URL are replaced with [REDACTED].
// Value-based redaction avoids false positives from key-name heuristics
// (e.g. `auth=public` would not be redacted) and catches tokens passed under
// non-standard parameter names.
function buildRedactor(config: BitbucketConfig): (text: string) => string {
  const secrets = [
    config.token,
    config.password,
    ...Object.values(config.customHeaders ?? {}),
  ].filter((v): v is string => !!v && v.length > 0);

  if (secrets.length === 0) return (text) => text;

  return (text) =>
    secrets.reduce((acc, secret) => acc.replaceAll(secret, "[REDACTED]"), text);
}

export function createApiClients(config: BitbucketConfig): ApiClients {
  const authHeaders: Record<string, string> = {};

  if (config.token) {
    authHeaders["Authorization"] = `Bearer ${config.token}`;
  } else if (config.username && config.password) {
    const credentials = Buffer.from(
      `${config.username}:${config.password}`,
    ).toString("base64");
    authHeaders["Authorization"] = `Basic ${credentials}`;
  }

  // Accept is stated explicitly. Bitbucket Server's REST API already
  // returns JSON by default, but well-behaved proxies/gateways in front
  // of it can honor `Accept: application/json` instead of returning
  // their own HTML error page. Proxies that ignore the Accept header
  // are handled separately in `handleToolError` (raw-body cap at 500
  // chars so an HTML login page cannot flood the MCP output).
  const allHeaders: Record<string, string> = {
    Accept: "application/json",
    ...authHeaders,
    ...config.customHeaders,
  };

  const redact = buildRedactor(config);

  const commonOptions: Options = {
    timeout: 30_000,
    retry: {
      limit: 2,
      methods: ["get"],
      statusCodes: [408, 429, 500, 502, 503, 504],
    },
    hooks: {
      beforeRequest: [
        ({ request }) => {
          for (const [key, value] of Object.entries(allHeaders)) {
            request.headers.set(key, value);
          }
          logger.debug(redact(`${request.method} ${request.url}`));
        },
      ],
      afterResponse: [
        ({ response }) => {
          if (!response.ok) {
            if (response.status === 429) {
              const reset = response.headers.get("X-RateLimit-Reset");
              if (reset) {
                const waitMs = Math.max(
                  0,
                  parseInt(reset, 10) * 1000 - Date.now(),
                );
                if (waitMs > 0) {
                  logger.warn(
                    `Rate limited (429); reset in ${waitMs}ms, retry handled by HTTP layer`,
                  );
                }
              }
            }
            logger.warn(redact(`HTTP ${response.status} ${response.url}`));
          }
        },
      ],
    },
  };

  const create = (path: string) =>
    ky.create({
      ...commonOptions,
      prefix: `${config.baseUrl}${path}`,
    });

  return {
    api: create("/rest/api/1.0"),
    buildStatus: create("/rest/build-status/1.0"),
    commentLikes: create("/rest/comment-likes/1.0"),
    emoticons: create("/rest/emoticons/latest"),
    insights: create("/rest/insights/latest"),
    search: create("/rest/search/latest"),
    branchUtils: create("/rest/branch-utils/1.0"),
    defaultReviewers: create("/rest/default-reviewers/1.0"),
    git: create("/rest/git/1.0"),
    ui: create("/rest/ui/latest"),
    ssh: create("/rest/ssh/1.0"),
    gpg: create("/rest/gpg/1.0"),
  };
}

export function getPaginated(
  client: KyInstance,
  url: string,
  options?: Options,
): Promise<Paginated> {
  return client
    .get(url, options)
    .json()
    .then((r) => validatePaginated(r, url));
}
