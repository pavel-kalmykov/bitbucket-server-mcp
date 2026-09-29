import { z } from "zod";
import { formatResponse, type ToolSuccessResult } from "../response/format.js";
import { toolAnnotations } from "../response/annotations.js";
import type { ToolContext } from "./shared.js";
import {
  fieldsHint,
  fieldsParam,
  projectParam,
  repositoryParam,
} from "./params.js";
import {
  curateList,
  curateResponse,
  DEFAULT_REVIEWER_FIELDS,
} from "../response/curate.js";

const actionParam = z
  .enum(["create", "update", "delete"])
  .describe("Operation to perform.");
type ConditionAction = z.infer<typeof actionParam>;

const matcherType = z
  .enum(["ANY_REF", "BRANCH", "PATTERN", "MODEL_CATEGORY", "MODEL_BRANCH"])
  .optional()
  .describe("Ref matcher type (default: ANY_REF).");

export function registerDefaultReviewerTools(ctx: ToolContext) {
  const { server, bb } = ctx;

  server.registerTool(
    "list_default_reviewer_conditions",
    {
      description:
        "List default reviewer conditions for a repository. These conditions determine which users are automatically added as reviewers to pull requests." +
        fieldsHint(DEFAULT_REVIEWER_FIELDS),
      inputSchema: z.strictObject({
        project: projectParam(),
        repository: repositoryParam(),
        fields: fieldsParam(),
      }),
      annotations: toolAnnotations(),
    },
    async ({ fields, ...params }) => {
      const conditions = await bb.defaultReviewers.list(params);

      return formatResponse(
        curateList(conditions, fields ?? DEFAULT_REVIEWER_FIELDS),
      );
    },
  );

  server.registerTool(
    "manage_default_reviewers",
    {
      description:
        'Manage default reviewer conditions for a repository. Actions: "create" (new condition), "update" (replace a condition by id), "delete" (remove a condition by id). A condition adds the listed reviewers to every pull request matching the ref matchers.' +
        fieldsHint(DEFAULT_REVIEWER_FIELDS),
      inputSchema: z.strictObject({
        action: actionParam,
        project: projectParam(),
        repository: repositoryParam(),
        conditionId: z
          .number()
          .optional()
          .describe("Condition ID (required for update and delete)."),
        reviewers: z
          .array(z.string())
          .optional()
          .describe("Reviewer usernames (required for create and update)."),
        targetRef: z
          .string()
          .optional()
          .describe(
            "Target ref matcher id, e.g. main or refs/heads/* (required for create and update).",
          ),
        targetType: matcherType,
        sourceRef: z
          .string()
          .optional()
          .describe("Source ref matcher id (optional; defaults to any ref)."),
        sourceType: matcherType,
        requiredApprovals: z
          .number()
          .min(0)
          .optional()
          .describe(
            "How many of the default reviewers must approve (required, 0 to add them all as optional reviewers).",
          ),
        fields: fieldsParam(),
      }),
      annotations: toolAnnotations({
        readOnlyHint: false,
        idempotentHint: false,
      }),
    },
    async ({
      action,
      project,
      repository,
      conditionId,
      reviewers,
      targetRef,
      targetType,
      sourceRef,
      sourceType,
      requiredApprovals,
      fields,
    }) => {
      const save = () => {
        if (!reviewers?.length) {
          throw new Error(
            "reviewers is required with at least one username for the " +
              action +
              " action.",
          );
        }
        if (!targetRef) {
          throw new Error(
            "targetRef is required for the " + action + " action.",
          );
        }
        if (!sourceRef) {
          throw new Error(
            "sourceRef is required for the " + action + " action.",
          );
        }
        if (requiredApprovals === undefined) {
          throw new Error(
            "requiredApprovals is required for the " + action + " action.",
          );
        }
        return {
          reviewers,
          target: { ref: targetRef, type: targetType },
          source: { ref: sourceRef, type: sourceType },
          requiredApprovals,
        };
      };
      const run: Record<ConditionAction, () => Promise<ToolSuccessResult>> = {
        create: async () => {
          const data = await bb.defaultReviewers.create({
            project,
            repository,
            ...save(),
          });
          return formatResponse(
            curateResponse(data, fields ?? DEFAULT_REVIEWER_FIELDS),
          );
        },
        update: async () => {
          if (!conditionId) {
            throw new Error("conditionId is required for the update action.");
          }
          const data = await bb.defaultReviewers.update({
            project,
            repository,
            conditionId,
            ...save(),
          });
          return formatResponse(
            curateResponse(data, fields ?? DEFAULT_REVIEWER_FIELDS),
          );
        },
        delete: async () => {
          if (!conditionId) {
            throw new Error("conditionId is required for the delete action.");
          }
          return formatResponse(
            await bb.defaultReviewers.delete({
              project,
              repository,
              conditionId,
            }),
          );
        },
      };
      return run[action]();
    },
  );
}
