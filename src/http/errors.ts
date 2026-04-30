import { HTTPError } from "ky";
import { logger } from "../logging.js";

interface ToolErrorResult {
  [key: string]: unknown;
  content: Array<{ type: "text"; text: string }>;
  isError: true;
}

const ERROR_GUIDANCE = {
  401: "Authentication failed. Verify BITBUCKET_TOKEN or BITBUCKET_USERNAME/BITBUCKET_PASSWORD environment variables.",
  403: "Permission denied. Your credentials may not have access to this resource.",
  404: "Not found. Verify the project key, repository slug, and PR/comment ID are correct.",
  409: "Version conflict. The resource was modified since you last fetched it. Re-fetch and retry with the updated version.",
  429: "Rate limited. Wait a moment before retrying; the server will retry automatically for GET requests.",
} as const satisfies Record<number, string>;

// Cap on how much of a raw body ends up in the returned MCP error. Bitbucket
// normally stays well under this; the cap guards against accidentally
// surfacing a 10 MiB HTML error page from a misconfigured proxy.
const MAX_BODY_CHARS = 500;

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
 * Pull the most actionable text out of a failed Bitbucket Server response
 * body. Bitbucket Server responds with
 *   { "errors": [{ "message": "...", "exceptionName": "..." }] }
 * on most failures, so prefer that shape. Fall back to a generic `.message`
 * field, then to the raw body (truncated).
 */
function hasExceptionName(data: unknown): boolean {
  if (data == null || typeof data !== "object") return false;
  const body = data as { errors?: unknown };
  if (!Array.isArray(body.errors) || body.errors.length === 0) return false;
  return body.errors.some(
    (e) =>
      e != null &&
      typeof e === "object" &&
      typeof (e as Record<string, unknown>).exceptionName === "string" &&
      (e as Record<string, unknown>).exceptionName !== "",
  );
}

function formatReviewerErrors(reviewerErrors: unknown): string | undefined {
  if (!Array.isArray(reviewerErrors)) return undefined;

  const parts: string[] = [];
  for (const re of reviewerErrors) {
    if (!(re && typeof re === "object")) continue;
    const r = re as Record<string, unknown>;
    const ctx = typeof r.context === "string" ? r.context : null;
    const rMsg = typeof r.message === "string" ? r.message : null;
    if (rMsg) {
      parts.push(ctx ? `reviewer "${ctx}": ${rMsg}` : `reviewer: ${rMsg}`);
    }
  }
  return parts.length > 0 ? parts.join("; ") : undefined;
}

function formatValidReviewers(validReviewers: unknown): string | undefined {
  if (!Array.isArray(validReviewers) || validReviewers.length === 0)
    return undefined;

  const names = validReviewers
    .map((vr) => {
      if (vr == null) return undefined;
      if (typeof vr === "object") {
        const v = vr as Record<string, unknown>;
        return v.user && typeof v.user === "object"
          ? (v.user as Record<string, unknown>).name
          : String(vr);
      }
      return String(vr);
    })
    .filter((n): n is string => typeof n === "string" && n.length > 0);

  return names.length > 0 ? `validReviewers: [${names.join(", ")}]` : undefined;
}

function formatErrorParts(e: Record<string, unknown>): string {
  const pieces: string[] = [];

  const core = [e.exceptionName, e.message].filter(
    (s): s is string => typeof s === "string" && s.length > 0,
  );
  pieces.push(...core);

  const reviewerText = formatReviewerErrors(e.reviewerErrors);
  if (reviewerText) pieces.push(reviewerText);

  const validReviewersText = formatValidReviewers(e.validReviewers);
  if (validReviewersText) pieces.push(validReviewersText);

  return pieces.join(": ");
}

export function extractBitbucketMessage(data: unknown): string {
  if (data == null) return "";

  if (typeof data === "string") {
    return data.slice(0, MAX_BODY_CHARS);
  }

  if (typeof data !== "object") return "";

  const body = data as { errors?: unknown; message?: unknown };

  if (Array.isArray(body.errors) && body.errors.length > 0) {
    const parts = (body.errors as Array<Record<string, unknown>>)
      .map(formatErrorParts)
      .filter((s) => s.length > 0);
    if (parts.length > 0) return parts.join("; ");
  }

  if (typeof body.message === "string") return body.message;

  return "";
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
  if (error instanceof HTTPError) {
    const { status } = error.response;
    const body = extractBitbucketMessage(error.data);
    const msg = body || error.message;
    logger.error(`API error ${status}`, msg);

    // Surface structured Bitbucket errors directly — the server's
    // exceptionName + message (+ reviewerErrors, etc.) is more actionable
    // than any generic status-based guidance we could add.
    if (hasExceptionName(error.data)) {
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
