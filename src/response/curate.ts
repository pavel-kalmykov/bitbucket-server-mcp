import { isRecord } from "../type-guards.js";
import type {
  Commit,
  Deployment,
  InsightReport,
  PullRequest,
  PullRequestActivity,
  RestApplicationUser,
  RestBranch,
  RestGpgKey,
  RestProject,
  RestPullRequestParticipant,
  RestPullRequestCondition,
  RestRefRestriction,
  RestRepository,
  RestRepositoryHook,
  RestReviewerGroup,
  RestSecretScanningAllowlistRule,
  RestTag,
  RestWebhook,
} from "../generated/types.js";

// Default field sets per entity type.
// Comma-separated top-level fields. Nested paths like "author.user.name" pick specific sub-fields.
// Use "*all" to bypass curation and return the raw API response.
//
// Field paths are validated by PathsOf<T> against the generated schemas.
// Fields the server adds that the spec does not declare (extras) are
// listed as literal strings next to each default with their cause.

type PathsOf<T> = T extends readonly (infer U)[]
  ? PathsOf<U>
  : T extends object
    ? {
        [K in keyof T & string]: NonNullable<T[K]> extends readonly (infer V)[]
          ? K | `${K}.${PathsOf<V>}`
          : NonNullable<T[K]> extends object
            ? K | `${K}.${PathsOf<NonNullable<T[K]>>}`
            : K;
      }[keyof T & string]
    : never;

type FieldOf<T, E extends string = never> = readonly (PathsOf<T> | E)[];

export function fieldsToString(fields: readonly string[]): string {
  return fields.join(",");
}

// The server nests author.user.name and adds properties.commentCount and
// the task counts; the spec has author.name inline and contentHash instead.
export const DEFAULT_PR_FIELDS: FieldOf<
  PullRequest,
  | "author.user.name"
  | "author.user.displayName"
  | "author.status"
  | "properties.commentCount"
  | "properties.openTaskCount"
  | "properties.resolvedTaskCount"
  | "properties.mergeResult"
> = [
  "id",
  "title",
  "description",
  "state",
  "createdDate",
  "updatedDate",
  "author.user.name",
  "author.user.displayName",
  "author.status",
  "fromRef.displayId",
  "toRef.displayId",
  "reviewers.user.name",
  "reviewers.user.displayName",
  "reviewers.status",
  "reviewers.approved",
  "properties.commentCount",
  "properties.openTaskCount",
  "properties.resolvedTaskCount",
  "properties.mergeResult",
] as FieldOf<PullRequest>;

export const DEFAULT_PROJECT_FIELDS: FieldOf<RestProject> = [
  "key",
  "id",
  "name",
  "description",
  "type",
  "public",
];

export const DEFAULT_REPOSITORY_FIELDS: FieldOf<RestRepository> = [
  "slug",
  "id",
  "name",
  "description",
  "state",
  "forkable",
  "project.key",
  "project.name",
];

// The server adds isDefault and metadata; the spec declares only default.
export const DEFAULT_BRANCH_FIELDS: FieldOf<
  RestBranch,
  "isDefault" | "metadata"
> = [
  "id",
  "displayId",
  "type",
  "latestCommit",
  "isDefault",
  "metadata",
] as FieldOf<RestBranch>;

// branchmodel is a branch-utils endpoint the spec does not describe.
export const DEFAULT_BRANCH_MODEL_FIELDS: string =
  "development.id,development.displayId,development.latestCommit," +
  "development.isDefault,production.id,production.displayId," +
  "production.latestCommit,production.isDefault," +
  "types.id,types.displayName,types.prefix," +
  "strategies.id,strategies.displayName,strategies.enabled";

// search is a plugin endpoint the spec does not describe.
export const DEFAULT_SEARCH_FIELDS: string =
  "file,hitCount,hitContexts,pathMatches," +
  "repository.slug,repository.name,repository.project.key";

export const DEFAULT_COMMIT_FIELDS: FieldOf<Commit> = [
  "id",
  "displayId",
  "message",
  "author.name",
  "author.emailAddress",
  "authorTimestamp",
  "committer.name",
  "committer.emailAddress",
  "committerTimestamp",
  "parents.id",
];

export const DEFAULT_TAG_FIELDS: FieldOf<RestTag> = [
  "id",
  "displayId",
  "type",
  "hash",
  "latestCommit",
];

// comment.* stays outside the type: RestComment.comments -> RestComment is
// circular and breaks the mapped type.
export const DEFAULT_ACTIVITY_FIELDS: FieldOf<
  PullRequestActivity,
  "comment.id" | "comment.text" | "comment.createdAt" | "comment.updatedAt"
> = [
  "id",
  "action",
  "createdDate",
  "user.name",
  "user.displayName",
  "comment.id",
  "comment.text",
  "comment.createdAt",
  "comment.updatedAt",
] as FieldOf<PullRequestActivity>;

export const DEFAULT_USER_FIELDS: FieldOf<RestApplicationUser> = [
  "name",
  "displayName",
  "emailAddress",
  "slug",
  "active",
  "type",
];

// The server adds matcher.value; the spec does not declare it.
// groups.name is a lie: groups is string[], so the field never exists in
// the response.
export const DEFAULT_BRANCH_RESTRICTION_FIELDS: FieldOf<
  RestRefRestriction,
  "matcher.value"
> = [
  "id",
  "type",
  "matcher.id",
  "matcher.type.id",
  "matcher.type.name",
  "matcher.value",
  "users.name",
  "users.displayName",
] as FieldOf<RestRefRestriction>;

export const DEFAULT_HOOK_FIELDS: FieldOf<RestRepositoryHook> = [
  "details.key",
  "details.name",
  "details.type",
  "details.description",
  "enabled",
  "configured",
];

export const DEFAULT_GPG_KEY_FIELDS: FieldOf<RestGpgKey> = [
  "id",
  "fingerprint",
  "emailAddress",
  "expiryDate",
];

export const DEFAULT_WEBHOOK_FIELDS: FieldOf<RestWebhook> = [
  "name",
  "url",
  "events",
  "active",
];

export const DEFAULT_REVIEWER_GROUP_FIELDS: FieldOf<RestReviewerGroup> = [
  "id",
  "name",
  "description",
  "users.name",
];

export const DEFAULT_SECRET_SCANNING_FIELDS: FieldOf<RestSecretScanningAllowlistRule> =
  ["id", "name", "lineRegex", "pathRegex"];

// project and repo permissions answer raw pages without a schema.
export const DEFAULT_PROJECT_PERMISSION_FIELDS: string =
  "group.name,user.name,permission";

export const DEFAULT_PARTICIPANT_FIELDS: FieldOf<RestPullRequestParticipant> = [
  "status",
  "approved",
  "role",
  "lastReviewedCommit",
  "user.name",
];

export const DEFAULT_REPOSITORY_PERMISSION_FIELDS: string =
  "group.name,user.name,permission";

export const DEFAULT_DEPLOYMENT_FIELDS: FieldOf<Deployment> = [
  "key",
  "state",
  "displayName",
  "description",
  "url",
  "environment.key",
  "environment.displayName",
  "environment.type",
  "deploymentSequenceNumber",
  "lastUpdated",
];

// RestComment.comments -> RestComment is circular and breaks the mapped
// type, so this one stays plain.
export const DEFAULT_COMMENT_FIELDS: string =
  "id,text,version,createdDate,updatedDate," +
  "author.name,author.displayName,severity,state,threadResolved," +
  "anchor.path,anchor.line,anchor.lineType";

export const DEFAULT_INSIGHT_FIELDS: FieldOf<InsightReport> = [
  "key",
  "result",
  "createdDate",
  "details",
  "link",
  "title",
  "reporter",
  "data",
];

export const DEFAULT_REVIEWER_FIELDS: FieldOf<RestPullRequestCondition> = [
  "id",
  "scope.type",
  "reviewers.name",
  "requiredApprovals",
  "sourceRefMatcher.type",
  "sourceRefMatcher.displayId",
  "targetRefMatcher.type",
  "targetRefMatcher.displayId",
];

function pickFieldsFromObject(
  source: Record<string, unknown>,
  fieldPaths: string[],
): Record<string, unknown> {
  // Group fields by their top-level key
  const topLevelGroups = new Map<string, string[]>();

  for (const path of fieldPaths) {
    const dotIndex = path.indexOf(".");
    if (dotIndex === -1) {
      topLevelGroups.set(path, []);
    } else {
      const topKey = path.slice(0, dotIndex);
      const rest = path.slice(dotIndex + 1);
      const existing = topLevelGroups.get(topKey) ?? [];
      existing.push(rest);
      topLevelGroups.set(topKey, existing);
    }
  }

  const result: Record<string, unknown> = {};

  for (const [key, subPaths] of topLevelGroups) {
    const value = source[key];
    if (value === undefined) continue;

    if (subPaths.length === 0) {
      // Top-level field, include as-is
      result[key] = value;
    } else if (Array.isArray(value)) {
      // Array: apply sub-field picking to each element
      result[key] = value.map((item) =>
        isRecord(item) ? pickFieldsFromObject(item, subPaths) : item,
      );
    } else if (isRecord(value)) {
      // Object: recurse with sub-paths
      result[key] = pickFieldsFromObject(value, subPaths);
    }
  }

  return result;
}

/**
 * Curate a response object by picking only the specified fields.
 *
 * @param data - The raw API response object
 * @param fields - Either a default field string (comma-separated paths), "*all" for no filtering,
 *                 or a custom comma-separated field list
 * @returns The curated object with only the requested fields
 */
export function curateResponse<T extends Record<string, unknown>>(
  data: T,
  fields: string | readonly string[],
): Record<string, unknown> {
  if (fields === "*all") {
    return data;
  }

  const fieldPaths =
    typeof fields === "string"
      ? fields
          .split(",")
          .map((f) => f.trim())
          .filter(Boolean)
      : [...fields];

  return pickFieldsFromObject(data, fieldPaths);
}

/**
 * Curate an array of response objects.
 */
export function curateList<T extends Record<string, unknown>>(
  items: T[],
  fields: string | readonly string[],
): Record<string, unknown>[] {
  if (fields === "*all") {
    return items;
  }
  return items.map((item) => curateResponse(item, fields));
}
