import { z } from "zod";
import { formatResponse } from "../response/format.js";
import { toolAnnotations } from "../response/annotations.js";
import type { ToolContext } from "./shared.js";
import {
  fieldsHint,
  fieldsParam,
  limitParam,
  projectParam,
  startParam,
} from "./params.js";
import {
  curateList,
  DEFAULT_PROJECT_PERMISSION_FIELDS,
} from "../response/curate.js";

const actionParam = z
  .enum(["list-groups", "list-users", "grant", "revoke"])
  .describe("Operation to perform.");
const subjectParam = z
  .enum(["group", "user"])
  .describe("Whether name refers to a group or a user.");
const permissionParam = z
  .enum(["PROJECT_READ", "PROJECT_WRITE", "PROJECT_ADMIN"])
  .optional()
  .describe("Permission to grant or revoke (required for grant and revoke).");

export function registerProjectPermissionTools(ctx: ToolContext) {
  const { server, bb } = ctx;

  server.registerTool(
    "manage_project_permissions",
    {
      description:
        'Manage project permissions for groups and users. Actions: "list-groups" and "list-users" (who has what), "grant" and "revoke" (set or remove a permission for one subject). PROJECT_READ < PROJECT_WRITE < PROJECT_ADMIN.' +
        fieldsHint(DEFAULT_PROJECT_PERMISSION_FIELDS),
      inputSchema: z.strictObject({
        action: actionParam,
        project: projectParam(),
        subject: subjectParam.optional(),
        permission: permissionParam,
        name: z
          .string()
          .optional()
          .describe(
            "Group or user name the permission applies to (required for grant and revoke).",
          ),
        filter: z
          .string()
          .optional()
          .describe("Filter subjects by name prefix (list actions)."),
        limit: limitParam(),
        start: startParam(),
        fields: fieldsParam(),
      }),
      annotations: toolAnnotations({
        readOnlyHint: false,
        idempotentHint: true,
      }),
    },
    async ({
      action,
      project,
      subject,
      permission,
      name,
      filter,
      limit,
      start,
      fields,
    }) => {
      if (action === "list-groups" || action === "list-users") {
        const params = { project, filter, limit, start };
        const page =
          action === "list-groups"
            ? await bb.projectPermissions.listGroups(params)
            : await bb.projectPermissions.listUsers(params);

        // The entries keep the endpoint shape until after curation, so
        // the fields param can reach group.name / user.name; the flat
        // { name, permission } shape is what agents consume.
        const permissions =
          fields === "*all"
            ? page.values
            : curateList(
                page.values,
                fields ?? DEFAULT_PROJECT_PERMISSION_FIELDS,
              ).map((entry) => {
                const subjectEntry = (entry.group ?? entry.user) as
                  | { name?: string }
                  | undefined;
                return {
                  name: subjectEntry?.name,
                  permission: entry.permission,
                };
              });

        return formatResponse({
          total: page.size,
          permissions,
          isLastPage: page.isLastPage,
        });
      }

      if (subject === undefined) {
        throw new Error(`subject is required for the ${action} action.`);
      }
      if (!name) {
        throw new Error(`name is required for the ${action} action.`);
      }

      if (action === "grant") {
        if (permission === undefined) {
          throw new Error(`permission is required for the ${action} action.`);
        }
        if (subject === "group") {
          await bb.projectPermissions.grantGroup({
            project,
            permission,
            name,
          });
        } else {
          await bb.projectPermissions.grantUser({
            project,
            permission,
            name,
          });
        }
        // The PUT answers with an empty body; the grant is the effect.
        return formatResponse({ granted: true, permission, name });
      }

      if (subject === "group") {
        await bb.projectPermissions.revokeGroup({ project, name });
      } else {
        await bb.projectPermissions.revokeUser({ project, name });
      }
      return formatResponse({ revoked: true, name });
    },
  );
}
