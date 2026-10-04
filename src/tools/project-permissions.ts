import { z } from "zod";
import { formatResponse, type ToolSuccessResult } from "../response/format.js";
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
type ProjectPermission = NonNullable<z.infer<typeof permissionParam>>;

type Subject = NonNullable<z.infer<typeof subjectParam>>;

interface ListArgs {
  project?: string;
  fields?: string;
  filter?: string;
  limit?: number;
  start?: number;
}

interface MutateArgs {
  project?: string;
  subject: Subject;
  permission: ProjectPermission;
  name: string;
}

function assertMutateArgs(
  raw: {
    project?: string;
    subject?: Subject;
    permission?: ProjectPermission;
    name?: string;
  },
  action: string,
): MutateArgs {
  const { project, subject, permission, name } = raw;
  if (subject === undefined) {
    throw new Error(`subject is required for the ${action} action.`);
  }
  if (action === "grant" && permission === undefined) {
    throw new Error(`permission is required for the ${action} action.`);
  }
  if (!name) {
    throw new Error(`name is required for the ${action} action.`);
  }
  // The revoke path never passes a permission, hence the narrowing here.
  return {
    project,
    subject,
    permission: permission as ProjectPermission,
    name,
  };
}

export function registerProjectPermissionTools(ctx: ToolContext) {
  const { server, bb } = ctx;

  const list = (
    endpoint: "groups" | "users",
    { project, fields, filter, limit, start }: ListArgs,
  ): Promise<ToolSuccessResult> => {
    const fetchPage =
      endpoint === "groups"
        ? bb.projectPermissions.listGroups.bind(bb.projectPermissions)
        : bb.projectPermissions.listUsers.bind(bb.projectPermissions);

    return fetchPage({ project, filter, limit, start }).then((page) => {
      // The entries keep the endpoint shape until after curation, so the
      // fields param can reach group.name / user.name; the flat
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
    });
  };

  const grant = (args: MutateArgs): Promise<ToolSuccessResult> => {
    const runOne =
      args.subject === "group"
        ? bb.projectPermissions.grantGroup.bind(bb.projectPermissions)
        : bb.projectPermissions.grantUser.bind(bb.projectPermissions);
    return runOne(args).then(() =>
      // The PUT answers with an empty body; the grant is the effect.
      formatResponse({
        granted: true,
        permission: args.permission,
        name: args.name,
      }),
    );
  };

  const revoke = (args: MutateArgs): Promise<ToolSuccessResult> => {
    const runOne =
      args.subject === "group"
        ? bb.projectPermissions.revokeGroup.bind(bb.projectPermissions)
        : bb.projectPermissions.revokeUser.bind(bb.projectPermissions);
    return runOne(args).then(() =>
      formatResponse({ revoked: true, name: args.name }),
    );
  };

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
    async ({ action, project, subject, permission, name, ...listArgs }) => {
      const run: Record<typeof action, () => Promise<ToolSuccessResult>> = {
        "list-groups": () => list("groups", { project, ...listArgs }),
        "list-users": () => list("users", { project, ...listArgs }),
        grant: () =>
          grant(
            assertMutateArgs({ project, subject, permission, name }, action),
          ),
        revoke: () =>
          revoke(assertMutateArgs({ project, subject, name }, action)),
      };
      return run[action]();
    },
  );
}
