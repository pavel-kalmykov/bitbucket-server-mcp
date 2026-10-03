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
  DEFAULT_SECRET_SCANNING_FIELDS,
} from "../response/curate.js";

const actionParam = z
  .enum(["create", "update", "delete"])
  .describe("Operation to perform.");
type RuleAction = z.infer<typeof actionParam>;

export function registerSecretScanningTools(ctx: ToolContext) {
  const { server, bb } = ctx;

  server.registerTool(
    "list_secret_scanning_rules",
    {
      description:
        "List secret scanning allowlist rules for a repository. Requires Bitbucket Server 8.5+." +
        fieldsHint(DEFAULT_SECRET_SCANNING_FIELDS),
      inputSchema: z.strictObject({
        project: projectParam(),
        repository: repositoryParam(),
        fields: fieldsParam(),
      }),
      annotations: toolAnnotations(),
    },
    async ({ fields, ...params }) => {
      const rules = await bb.secretScanning.list(params);

      return formatResponse(
        curateList(rules, fields ?? DEFAULT_SECRET_SCANNING_FIELDS),
      );
    },
  );

  server.registerTool(
    "manage_secret_scanning",
    {
      description:
        'Manage secret scanning allowlist rules for a repository. Actions: "create" (new rule), "update" (replace a rule by id), "delete" (remove a rule by id). A rule excludes secrets matching its regexes from scanning. Requires Bitbucket Server 8.5+.' +
        fieldsHint(DEFAULT_SECRET_SCANNING_FIELDS),
      inputSchema: z.strictObject({
        action: actionParam,
        project: projectParam(),
        repository: repositoryParam(),
        ruleId: z
          .number()
          .optional()
          .describe("Rule ID (required for update and delete)."),
        name: z
          .string()
          .optional()
          .describe(
            "Human readable rule name (required for create and update).",
          ),
        lineRegex: z
          .string()
          .optional()
          .describe(
            "Regex matching the secret on a code line (required for create).",
          ),
        pathRegex: z
          .string()
          .optional()
          .describe("Regex matching file names (optional)."),
        fields: fieldsParam(),
      }),
      annotations: toolAnnotations({
        readOnlyHint: false,
        idempotentHint: false,
        destructiveHint: true,
      }),
    },
    async ({
      action,
      project,
      repository,
      ruleId,
      name,
      lineRegex,
      pathRegex,
      fields,
    }) => {
      const run: Record<RuleAction, () => Promise<ToolSuccessResult>> = {
        create: async () => {
          if (!name) throw new Error("name is required for the create action.");
          if (!lineRegex) {
            throw new Error("lineRegex is required for the create action.");
          }
          const data = await bb.secretScanning.create({
            project,
            repository,
            name,
            lineRegex,
            pathRegex,
          });
          return formatResponse(
            curateResponse(data, fields ?? DEFAULT_SECRET_SCANNING_FIELDS),
          );
        },
        update: async () => {
          if (!ruleId) {
            throw new Error("ruleId is required for the update action.");
          }
          if (!name) throw new Error("name is required for the update action.");
          const data = await bb.secretScanning.update({
            project,
            repository,
            ruleId,
            name,
            lineRegex,
            pathRegex,
          });
          return formatResponse(
            curateResponse(data, fields ?? DEFAULT_SECRET_SCANNING_FIELDS),
          );
        },
        delete: async () => {
          if (!ruleId) {
            throw new Error("ruleId is required for the delete action.");
          }
          return formatResponse(
            await bb.secretScanning.delete({ project, repository, ruleId }),
          );
        },
      };
      return run[action]();
    },
  );
}
