import { z } from "zod";

// Shared input-schema fragments used across tool definitions.
// Keep this a cohesive "schema vocabulary", not a general dumping ground.

/**
 * Optional `fields` selector for read tools that curate their response.
 *
 * The description is deliberately short and generic: the schema ships on
 * every tool every session, and the curated default applies automatically
 * when the caller omits `fields`, so there is no value in repeating the
 * per-entity default inline. Omit for the curated default; pass `*all` for
 * the raw API response; otherwise pass comma-separated dot paths
 * (e.g. "author.user.name,state").
 */
export function fieldsParam() {
  return z
    .string()
    .optional()
    .describe(
      "Comma-separated fields to return (dot notation for nested paths). Omit for a curated default; use '*all' for the full raw API response.",
    );
}
