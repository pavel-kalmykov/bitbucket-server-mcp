import type { ToolContext } from "./shared.js";
import { registerBranchTools } from "./branches.js";
import { registerCommentTools } from "./comments.js";
import { registerCommitCommentTools } from "./commit-comments.js";
import { registerDefaultReviewerTools } from "./default-reviewers.js";
import { registerDeploymentTools } from "./deployments.js";
import { registerForkTools } from "./forks.js";
import { registerGpgKeyTools } from "./gpg-keys.js";
import { registerHookTools } from "./hooks.js";
import { registerInsightTools } from "./insights.js";
import { registerLabelTools } from "./labels.js";
import { registerMergeCheckTools } from "./merge-checks.js";
import {
  registerPullRequestTools,
  registerReviewTools,
} from "./pull-requests.js";
import { registerRepositoryTools } from "./repositories.js";
import { registerReviewerGroupTools } from "./reviewer-groups.js";
import { registerSearchTools } from "./search.js";
import { registerSecretScanningTools } from "./secret-scanning.js";
import { registerSshKeyTools } from "./ssh-keys.js";
import { registerSystemTools } from "./system.js";
import { registerTagTools } from "./tags.js";
import { registerUserTools } from "./users.js";
import { registerWebhookTools } from "./webhooks.js";

export const TOOL_REGISTRARS: Array<(ctx: ToolContext) => void> = [
  registerRepositoryTools,
  registerForkTools,
  registerBranchTools,
  registerTagTools,
  registerPullRequestTools,
  registerCommentTools,
  registerReviewTools,
  registerSearchTools,
  registerInsightTools,
  registerSystemTools,
  registerDefaultReviewerTools,
  registerUserTools,
  registerLabelTools,
  registerWebhookTools,
  registerCommitCommentTools,
  registerHookTools,
  registerMergeCheckTools,
  registerReviewerGroupTools,
  registerSecretScanningTools,
  registerSshKeyTools,
  registerGpgKeyTools,
  registerDeploymentTools,
];
