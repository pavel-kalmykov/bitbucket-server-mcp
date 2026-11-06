import type { ApiContext } from "./context.js";

export type PassthroughMethod = "GET" | "POST" | "PUT" | "DELETE";

export interface CallApiParams {
  method: PassthroughMethod;
  /** Path relative to the Bitbucket base URL, starting with /rest/. */
  path: string;
  body?: Record<string, unknown>;
}

export interface PassthroughApi {
  call(params: CallApiParams): Promise<unknown>;
}

/**
 * Validate and normalize a caller-supplied relative path. Rejects anything
 * that is not a plain /rest/ path: absolute URLs would turn the tool into a
 * general HTTP client against whatever host the URL names (SSRF), and
 * non-/rest/ routes are outside the API surface this client authenticates
 * for. Leading `//` is rejected before collapsing duplicate slashes so a
 * scheme-relative URL cannot slip through the normalization.
 */
export function normalizeApiPath(path: string): string {
  const trimmed = path.trim();
  if (trimmed.length === 0) {
    throw new Error(
      "path is required. Use a path starting with /rest/, e.g. /rest/api/1.0/projects.",
    );
  }
  if (/^[a-z][a-z0-9+.-]*:/i.test(trimmed) || trimmed.startsWith("//")) {
    throw new Error(
      `path must be relative to the Bitbucket base URL; got "${trimmed}". Pass a path starting with /rest/, e.g. /rest/api/1.0/projects.`,
    );
  }
  if (!trimmed.startsWith("/rest/")) {
    throw new Error(
      `path must start with /rest/; got "${trimmed}". Non-REST routes are not supported, e.g. /rest/api/1.0/projects or /rest/branch-utils/1.0/projects/PROJ/repos/repo/branch-model.`,
    );
  }
  return trimmed.replaceAll(/\/{2,}/g, "/");
}

export function passthroughApi(ctx: ApiContext): PassthroughApi {
  return {
    async call({ method, path, body }: CallApiParams) {
      const normalized = normalizeApiPath(path);
      const options = body === undefined ? {} : { json: body };
      // The full path (prefix included) rides on the root client, whose
      // prefix is just the base URL: plugin endpoints live outside
      // /rest/api/1.0, so the shared per-domain clients cannot serve them.
      const response = await ctx.http.root[
        method.toLowerCase() as Lowercase<PassthroughMethod>
      ](normalized.replace(/^\//, ""), options);
      // 204 responses (build-status POST, several mutations) have no body.
      if (response.status === 204) {
        return null;
      }
      return response.json();
    },
  };
}
