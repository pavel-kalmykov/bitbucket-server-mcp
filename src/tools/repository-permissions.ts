import { z } from "zod";
import { formatResponse, type ToolSuccessResult } from "../response/format.js";
import { toolAnnotations } from "../response/annotations.js";
import type { ToolContext } from "./shared.js";
import {
  fieldsHint,
  fieldsParam,
  limitParam,
  projectParam,
  repositoryParam,
  startParam,
} from "./params.js";
import {
  curateList,
  DEFAULT_REPOSITORY_PERMISSION_FIELDS,
} from "../response/curate.js";

const actionParam = z
  .enum(["list-groups", "list-users", "grant", "revoke"])
  .describe("Operation to perform.");
const subjectParam = z
  .enum(["group", "user"])
  .describe("Whether names refers to groups or users.");
const permissionParam = z
  .enum(["REPO_READ", "REPO_WRITE", "REPO_ADMIN"])
  .optional()
  .describe("Permission to grant or revoke (required for grant and revoke).");
type RepositoryPermission = NonNullable<z.infer<typeof permissionParam>>;

function assertMutateArgs(
  raw: {
    project?: string;
    repository: string;
    subject?: "group" | "user";
    permission?: "REPO_READ" | "REPO_WRITE" | "REPO_ADMIN";
    names?: string[];
  },
  action: string,
): {
  project?: string;
  repository: string;
  subject: "group" | "user";
  permission: RepositoryPermission;
  names: string[];
} {
  const { project, repository, subject, permission, names = [] } = raw;
  if (subject === undefined) {
    throw new Error(`subject is required for the ${action} action.`);
  }
  if (action === "grant") {
    if (permission === undefined) {
      throw new Error(`permission is required for the ${action} action.`);
    }
    if (names.length === 0) {
      throw new Error(
        `names is required with at least one entry for the ${action} action.`,
      );
    }
  }
  return {
    project,
    repository,
    subject,
    permission: permission as RepositoryPermission,
    names,
  };
}

export function registerRepositoryPermissionTools(ctx: ToolContext) {
  const { server, bb } = ctx;

  const list = (
    endpoint: "groups" | "users",
    {
      project,
      repository,
      fields,
      filter,
      limit,
      start,
    }: {
      project?: string;
      repository: string;
      fields?: string;
      filter?: string;
      limit?: number;
      start?: number;
    },
  ): Promise<ToolSuccessResult> => {
    const fetchPage =
      endpoint === "groups"
        ? bb.repositoryPermissions.listGroups.bind(bb.repositoryPermissions)
        : bb.repositoryPermissions.listUsers.bind(bb.repositoryPermissions);

    return fetchPage({ project, repository, filter, limit, start }).then(
      (page) => {
        // The entries keep the endpoint shape until after curation, so the
        // fields param can reach group.name / user.name; the flat
        // { name, permission } shape is what agents consume.
        const permissions =
          fields === "*all"
            ? page.values
            : curateList(
                page.values,
                fields ?? DEFAULT_REPOSITORY_PERMISSION_FIELDS,
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
      },
    );
  };

  server.registerTool(
    "manage_repository_permissions",
    {
      description:
        'Manage repository permissions for groups and users. Actions: "list-groups" and "list-users" (who has what), "grant" and "revoke" (set or remove a permission). REPO_READ < REPO_WRITE < REPO_ADMIN. The grant accepts several names in one call; the revoke removes one subject at a time.' +
        fieldsHint(DEFAULT_REPOSITORY_PERMISSION_FIELDS),
      inputSchema: z.strictObject({
        action: actionParam,
        project: projectParam(),
        repository: repositoryParam(),
        subject: subjectParam.optional(),
        permission: permissionParam,
        names: z
          .array(z.string())
          .optional()
          .describe(
            "Group or user names (required for grant; the API grants them in one call).",
          ),
        name: z
          .string()
          .optional()
          .describe("Group or user name (required for revoke, one at a time)."),
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
      repository,
      subject,
      permission,
      names,
      name,
      ...listArgs
    }) => {
      const run: Record<typeof action, () => Promise<ToolSuccessResult>> = {
        "list-groups": () =>
          list("groups", { project, repository, ...listArgs }),
        "list-users": () => list("users", { project, repository, ...listArgs }),
        grant: () => {
          const args = assertMutateArgs(
            { project, repository, subject, permission, names },
            action,
          );
          const runOne =
            args.subject === "group"
              ? bb.repositoryPermissions.grantGroup.bind(
                  bb.repositoryPermissions,
                )
              : bb.repositoryPermissions.grantUser.bind(
                  bb.repositoryPermissions,
                );
          return runOne(args).then(() =>
            // The PUT answers with an empty body; the grant is the effect.
            formatResponse({
              granted: true,
              permission: args.permission,
              names: args.names,
            }),
          );
        },
        revoke: () => {
          if (!name) {
            throw new Error(`name is required for the ${action} action.`);
          }
          const args = assertMutateArgs(
            { project, repository, subject },
            action,
          );
          const runOne =
            args.subject === "group"
              ? bb.repositoryPermissions.revokeGroup.bind(
                  bb.repositoryPermissions,
                )
              : bb.repositoryPermissions.revokeUser.bind(
                  bb.repositoryPermissions,
                );
          return runOne({ project, repository, name }).then(() =>
            formatResponse({ revoked: true, name }),
          );
        },
      };
      return run[action]();
    },
  );
}
