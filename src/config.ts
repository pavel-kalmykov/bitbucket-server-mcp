import type { BitbucketConfig, BitbucketServerOptions } from './types.js';

function parseCustomHeaders(raw?: string): Record<string, string> {
  if (!raw) return {};
  const headers: Record<string, string> = {};
  for (const pair of raw.split(',')) {
    const idx = pair.indexOf('=');
    if (idx > 0) {
      headers[pair.slice(0, idx).trim()] = pair.slice(idx + 1).trim();
    }
  }
  return headers;
}

export function parseConfig(options?: BitbucketServerOptions): BitbucketConfig {
  const baseUrl = (options?.baseUrl ?? process.env.BITBUCKET_URL ?? '').replace(/\/+$/, '');
  const token = options?.token ?? process.env.BITBUCKET_TOKEN;
  const username = options?.username ?? process.env.BITBUCKET_USERNAME;
  const password = options?.password ?? process.env.BITBUCKET_PASSWORD;

  if (!baseUrl) {
    throw new Error('BITBUCKET_URL is required. Set it as an environment variable or pass baseUrl in options.');
  }

  if (!token && !(username && password)) {
    throw new Error(
      'Authentication is required. Provide BITBUCKET_TOKEN or both BITBUCKET_USERNAME and BITBUCKET_PASSWORD.'
    );
  }

  const readOnlyRaw = process.env.BITBUCKET_READ_ONLY;
  const maxLinesRaw = process.env.BITBUCKET_DIFF_MAX_LINES_PER_FILE;
  const enabledToolsRaw = process.env.BITBUCKET_ENABLED_TOOLS;
  const cacheTtlRaw = process.env.BITBUCKET_CACHE_TTL;

  return {
    baseUrl,
    token,
    username,
    password,
    defaultProject: options?.defaultProject ?? process.env.BITBUCKET_DEFAULT_PROJECT,
    maxLinesPerFile: options?.maxLinesPerFile ?? (maxLinesRaw ? parseInt(maxLinesRaw, 10) : undefined),
    readOnly: options?.readOnly ?? readOnlyRaw === 'true',
    customHeaders: options?.customHeaders ?? parseCustomHeaders(process.env.BITBUCKET_CUSTOM_HEADERS),
    enabledTools: options?.enabledTools ?? (enabledToolsRaw ? enabledToolsRaw.split(',').map(t => t.trim()) : undefined),
    cacheTtlMs: options?.cacheTtlMs ?? (cacheTtlRaw ? parseInt(cacheTtlRaw, 10) * 1000 : 5 * 60 * 1000),
  };
}
