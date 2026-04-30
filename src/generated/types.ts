/**
 * Re-exports of Bitbucket Server API types from the OpenAPI spec.
 * Generated from the official Atlassian spec (v8.5).
 *
 * We use 8.5 because it's the lowest version that includes all schemas
 * we need (including RestUserReaction/RestEmoticon added in 8.5).
 * The project supports Bitbucket Server/DC 7.x+, and the core schemas
 * (PR, Comment, Branch, etc.) are identical between 7.x and 8.x.
 * No 7.x OpenAPI spec exists (only WADL).
 *
 * For types not in the spec (search, emoticons), define manually below.
 */
import type { components } from "./bitbucket-api.js";

// Core entities
export type PullRequest = components["schemas"]["RestPullRequest"];
export type Commit = components["schemas"]["RestCommit"];
export type PullRequestActivity =
  components["schemas"]["RestPullRequestActivity"];

// CI / Insights
export type InsightReport = components["schemas"]["RestInsightReport"];

// Request bodies
export type PullRequestMergeRequest =
  components["schemas"]["RestPullRequestMergeRequest"];
export type PullRequestDeclineRequest =
  components["schemas"]["RestPullRequestDeclineRequest"];
