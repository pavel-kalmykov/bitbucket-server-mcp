import { HTTPError } from "ky";
import { z } from "zod";

// Cap on how much of a raw body ends up in an error message. Bitbucket
// normally stays well under this; the cap guards against accidentally
// surfacing a 10 MiB HTML error page from a misconfigured proxy.
const MAX_BODY_CHARS = 500;

// Field-level catches mirror the per-field typeof filters this module used
// to hand-roll: a wrong-typed field is ignored, it never fails the entry.
const optionalString = z.string().optional().catch(undefined);

const errorBodySchema = z.object({
  errors: z.array(z.unknown()).optional().catch(undefined),
  message: optionalString,
});

const errorEntrySchema = z.object({
  exceptionName: optionalString,
  message: optionalString,
  reviewerErrors: z.array(z.unknown()).optional().catch(undefined),
  validReviewers: z.array(z.unknown()).optional().catch(undefined),
});

const reviewerErrorSchema = z.object({
  context: optionalString,
  message: optionalString,
});

const validReviewerSchema = z.object({
  user: z.object({ name: z.unknown().optional() }).optional().catch(undefined),
});

export function hasExceptionName(data: unknown): boolean {
  const body = errorBodySchema.safeParse(data);
  if (!body.success) return false;
  const { errors } = body.data;
  if (!errors || errors.length === 0) return false;
  return errors.some((entry) => {
    const parsed = errorEntrySchema.safeParse(entry);
    return parsed.success && (parsed.data.exceptionName ?? "") !== "";
  });
}

function formatReviewerErrors(
  reviewerErrors: unknown[] | undefined,
): string | undefined {
  if (!reviewerErrors) return undefined;

  const parts: string[] = [];
  for (const re of reviewerErrors) {
    const parsed = reviewerErrorSchema.safeParse(re);
    if (!parsed.success) continue;
    const { context: ctx, message: rMsg } = parsed.data;
    if (rMsg) {
      parts.push(ctx ? `reviewer "${ctx}": ${rMsg}` : `reviewer: ${rMsg}`);
    }
  }
  return parts.length > 0 ? parts.join("; ") : undefined;
}

function formatValidReviewers(
  validReviewers: unknown[] | undefined,
): string | undefined {
  if (!validReviewers || validReviewers.length === 0) return undefined;

  const names = validReviewers
    .map((vr): unknown => {
      if (vr == null) return undefined;
      const parsed = validReviewerSchema.safeParse(vr);
      if (!parsed.success) return String(vr);
      return parsed.data.user ? parsed.data.user.name : String(vr);
    })
    .filter((n): n is string => typeof n === "string" && n.length > 0);

  return names.length > 0 ? `validReviewers: [${names.join(", ")}]` : undefined;
}

function formatErrorParts(entry: unknown): string {
  const parsed = errorEntrySchema.safeParse(entry);
  if (!parsed.success) return "";
  const e = parsed.data;

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

  const body = errorBodySchema.safeParse(data);
  if (!body.success) return "";

  const { errors, message } = body.data;
  if (errors && errors.length > 0) {
    const parts = errors.map(formatErrorParts).filter((s) => s.length > 0);
    if (parts.length > 0) return parts.join("; ");
  }

  return message ?? "";
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
