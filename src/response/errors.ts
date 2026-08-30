import { logger } from "../logging.js";
import { BitbucketApiError, hasExceptionName } from "../api/http/errors.js";
import type { ToolErrorResult } from "./format.js";

const ERROR_GUIDANCE = {
  401: "Authentication failed. Verify BITBUCKET_TOKEN or BITBUCKET_USERNAME/BITBUCKET_PASSWORD environment variables.",
  403: "Permission denied. Your credentials may not have access to this resource.",
  404: "Not found. Verify the project key, repository slug, and PR/comment ID are correct.",
  409: "Version conflict. The resource was modified since you last fetched it. Re-fetch and retry with the updated version.",
  429: "Rate limited. Wait a moment before retrying; the server will retry automatically for GET requests.",
} as const satisfies Record<number, string>;

export function formatApiError(
  status: number,
  serverResponse: string,
): ToolErrorResult {
  const guidance =
    ERROR_GUIDANCE[status as keyof typeof ERROR_GUIDANCE] ??
    (status >= 500
      ? "Bitbucket server error. The server may be temporarily unavailable; try again."
      : `Unexpected HTTP ${status} error.`);

  return {
    content: [
      {
        type: "text",
        text: `${guidance}\n\nServer response: ${serverResponse}`,
      },
    ],
    isError: true,
  };
}

/**
 * Map any thrown value from a tool handler to an MCP-shaped error result.
 *
 * For ky's `HTTPError`, the parsed response body lives on `error.data`
 * (ky v2 pre-parses JSON before throwing). Read it directly and extract a
 * Bitbucket message so callers get the actual server reason
 * (`exceptionName: message`) instead of ky's generic "Request failed".
 *
 * Do NOT duck-type on `error.response.data?.message`: ky does not populate
 * `response.data`. The previous implementation did and the body was being
 * silently dropped in production.
 */
export function handleToolError(error: unknown): ToolErrorResult {
  if (error instanceof BitbucketApiError) {
    const { status, message: msg } = error;
    logger.error(`API error ${status}`, msg);

    // Surface structured Bitbucket errors directly — the server's
    // exceptionName + message (+ reviewerErrors, etc.) is more actionable
    // than any generic status-based guidance we could add.
    if (hasExceptionName(error.body)) {
      return {
        content: [{ type: "text", text: msg }],
        isError: true,
      };
    }

    return formatApiError(status, msg);
  }

  const message = error instanceof Error ? error.message : String(error);
  logger.error("Tool error", message);
  return {
    content: [{ type: "text", text: `Unexpected error: ${message}` }],
    isError: true,
  };
}
