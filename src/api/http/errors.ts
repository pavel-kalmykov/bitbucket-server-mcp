import { HTTPError } from "ky";

// Cap on how much of a raw body ends up in an error message. Bitbucket
// normally stays well under this; the cap guards against accidentally
// surfacing a 10 MiB HTML error page from a misconfigured proxy.
const MAX_BODY_CHARS = 500;

export function hasExceptionName(data: unknown): boolean {
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

/**
 * Pull the most actionable text out of a failed Bitbucket Server response
 * body. Bitbucket Server responds with
 *   { "errors": [{ "message": "...", "exceptionName": "..." }] }
 * on most failures, so prefer that shape. Fall back to a generic `.message`
 * field, then to the raw body (truncated).
 */
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
 * What every failed Bitbucket call throws. `message` already carries the
 * server's own reason (`exceptionName: message`, reviewer errors, and so on),
 * so a caller never has to know which HTTP library made the request.
 */
export class BitbucketApiError extends Error {
  readonly status: number;
  readonly url: string;
  readonly body: unknown;

  constructor(params: {
    message: string;
    status: number;
    url: string;
    body: unknown;
  }) {
    super(params.message);
    this.name = "BitbucketApiError";
    this.status = params.status;
    this.url = params.url;
    this.body = params.body;
  }

  static from(error: HTTPError): BitbucketApiError {
    return new BitbucketApiError({
      message: extractBitbucketMessage(error.data) || error.message,
      status: error.response.status,
      url: error.response.url,
      body: error.data,
    });
  }
}
