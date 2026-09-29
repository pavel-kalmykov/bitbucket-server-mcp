import { z } from "zod";
import { formatResponse, type ToolSuccessResult } from "../response/format.js";
import { toolAnnotations } from "../response/annotations.js";
import { curateResponse, DEFAULT_PROJECT_FIELDS } from "../response/curate.js";
import type { ToolContext } from "./shared.js";
import { fieldsHint, fieldsParam } from "./params.js";

const actionParam = z
  .enum(["create", "update", "delete"])
  .describe("Operation to perform.");
type ProjectAction = z.infer<typeof actionParam>;

export function registerProjectTools(ctx: ToolContext) {
  const { server, bb } = ctx;

  server.registerTool(
    "manage_projects",
    {
      description:
        'Manage Bitbucket projects. Actions: "create" (new project), "update" (rename, describe, or change visibility), "delete" (permanently removes the project and every repository in it). The API uppercases the key.' +
        fieldsHint(DEFAULT_PROJECT_FIELDS),
      inputSchema: z.strictObject({
        action: actionParam,
        project: z
          .string()
          .optional()
          .describe("Project key (required for update and delete)."),
        name: z
          .string()
          .optional()
          .describe("Project name (required for create)."),
        key: z
          .string()
          .optional()
          .describe(
            "Project key, uppercased by the API (required for create).",
          ),
        description: z
          .string()
          .optional()
          .describe("Project description (create and update)."),
        public: z
          .boolean()
          .optional()
          .describe("Whether the project is publicly visible."),
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
      name,
      key,
      description,
      public: isPublic,
      fields,
    }) => {
      const run: Record<ProjectAction, () => Promise<ToolSuccessResult>> = {
        create: async () => {
          if (!name) throw new Error("name is required for the create action.");
          if (!key) throw new Error("key is required for the create action.");
          const data = await bb.projects.create({
            name,
            key,
            description,
            public: isPublic,
          });
          return formatResponse(
            curateResponse(data, fields ?? DEFAULT_PROJECT_FIELDS),
          );
        },
        update: async () => {
          if (!project) {
            throw new Error("project is required for the update action.");
          }
          const data = await bb.projects.update({
            project,
            name,
            description,
            public: isPublic,
          });
          return formatResponse(
            curateResponse(data, fields ?? DEFAULT_PROJECT_FIELDS),
          );
        },
        delete: async () => {
          if (!project) {
            throw new Error("project is required for the delete action.");
          }
          return formatResponse(await bb.projects.delete({ project }));
        },
      };
      return run[action]();
    },
  );
}
