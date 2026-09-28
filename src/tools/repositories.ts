import { readFile, writeFile } from "node:fs/promises";
import { basename } from "node:path";
import { z } from "zod";
import { formatResponse, buildPaginated } from "../response/format.js";
import { toolAnnotations } from "../response/annotations.js";
import {
  curateList,
  curateResponse,
  DEFAULT_PROJECT_FIELDS,
  DEFAULT_REPOSITORY_FIELDS,
} from "../response/curate.js";
import type { ToolContext } from "./shared.js";
import {
  projectParam,
  repositoryParam,
  startParam,
  fieldsParam,
} from "./params.js";

export function registerRepositoryTools(ctx: ToolContext) {
  const { server, bb } = ctx;

  server.registerTool(
    "list_projects",
    {
      description:
        "List all Bitbucket projects you have access to. Use this first to discover project keys. Supports custom field selection via the `fields` param (`'*all'` for full raw response, `'key,name'` for a custom subset).",
      inputSchema: z.strictObject({
        limit: z
          .number()
          .optional()
          .describe("Number of projects to return (default: 25, max: 1000)"),
        start: startParam(),
        fields: fieldsParam(),
      }),
      annotations: toolAnnotations(),
    },
    async ({ fields, ...params }) => {
      const data = await bb.projects.list(params);

      return formatResponse(
        buildPaginated(data, {
          projects: curateList(data.values, fields ?? DEFAULT_PROJECT_FIELDS),
        }),
      );
    },
  );

  server.registerTool(
    "list_repositories",
    {
      description:
        "List repositories in a project. Use this to find repository slugs for other operations. Supports custom field selection via the `fields` param (`'*all'` for full raw response, `'slug,name'` for a custom subset).",
      inputSchema: z.strictObject({
        project: projectParam(),
        limit: z
          .number()
          .optional()
          .describe(
            "Number of repositories to return (default: 25, max: 1000)",
          ),
        start: startParam(),
        fields: fieldsParam(),
      }),
      annotations: toolAnnotations(),
    },
    async ({ fields, ...params }) => {
      const data = await bb.repositories.list(params);

      return formatResponse(
        buildPaginated(data, {
          repositories: curateList(
            data.values,
            fields ?? DEFAULT_REPOSITORY_FIELDS,
          ),
        }),
      );
    },
  );

  server.registerTool(
    "browse_repository",
    {
      description:
        "Browse files and directories in a repository to understand project structure.",
      inputSchema: z.strictObject({
        project: projectParam(),
        repository: repositoryParam(),
        path: z
          .string()
          .optional()
          .describe("Directory path to browse (default: root)."),
        branch: z
          .string()
          .optional()
          .describe("Branch or commit hash (default: default branch)."),
        limit: z
          .number()
          .optional()
          .describe("Max items to return (default: 50)."),
      }),
      annotations: toolAnnotations(),
    },
    async (params) => formatResponse(await bb.repositories.browse(params)),
  );

  server.registerTool(
    "get_file_content",
    {
      description:
        "Read file contents from a repository with pagination support for large files.",
      inputSchema: z.strictObject({
        project: projectParam(),
        repository: repositoryParam(),
        filePath: z.string().describe("Path to the file in the repository."),
        branch: z
          .string()
          .optional()
          .describe("Branch or commit hash (default: default branch)."),
        limit: z
          .number()
          .optional()
          .describe("Max lines per request (default: 100, max: 1000)."),
        start: z
          .number()
          .optional()
          .describe("Starting line number (default: 0)."),
      }),
      annotations: toolAnnotations(),
    },
    async (params) => formatResponse(await bb.repositories.getFile(params)),
  );

  server.registerTool(
    "upload_attachment",
    {
      description:
        "Upload a file attachment to a repository. Returns a markdown reference to embed in PR comments or descriptions.",
      inputSchema: z.strictObject({
        project: projectParam(),
        repository: repositoryParam(),
        filePath: z
          .string()
          .describe("Absolute path to the file on the local filesystem."),
      }),
      annotations: toolAnnotations({
        readOnlyHint: false,
        idempotentHint: false,
      }),
    },
    async ({ project, repository, filePath }) => {
      const fileName = basename(filePath);
      const attachment = await bb.repositories.uploadAttachment({
        project,
        repository,
        fileName,
        data: new Blob([await readFile(filePath)]),
      });

      return formatResponse(attachment);
    },
  );

  server.registerTool(
    "download_attachment",
    {
      description:
        "Download a repository attachment by id and write its content to a local file.",
      inputSchema: z.strictObject({
        project: projectParam(),
        repository: repositoryParam(),
        attachmentId: z
          .string()
          .describe("Attachment ID, as returned by upload_attachment."),
        filePath: z
          .string()
          .describe("Local path to write the attachment content to."),
      }),
      annotations: toolAnnotations(),
    },
    async ({ project, repository, attachmentId, filePath }) => {
      const { data, contentType, size } =
        await bb.repositories.downloadAttachment({
          project,
          repository,
          attachmentId,
        });
      await writeFile(filePath, data);
      return formatResponse({
        attachmentId,
        contentType,
        size,
        savedTo: filePath,
      });
    },
  );

  server.registerTool(
    "delete_attachment",
    {
      description:
        "Delete a repository attachment by id. Requires permission to manage the repository's attachments.",
      inputSchema: z.strictObject({
        project: projectParam(),
        repository: repositoryParam(),
        attachmentId: z
          .string()
          .describe("Attachment ID, as returned by upload_attachment."),
      }),
      annotations: toolAnnotations({
        readOnlyHint: false,
        destructiveHint: true,
        idempotentHint: true,
      }),
    },
    async ({ project, repository, attachmentId }) =>
      formatResponse(
        await bb.repositories.deleteAttachment({
          project,
          repository,
          attachmentId,
        }),
      ),
  );

  server.registerTool(
    "edit_file",
    {
      description:
        "Edit a file in a repository by committing a new version via the Bitbucket REST API. Returns the commit metadata.",
      inputSchema: z.strictObject({
        project: projectParam(),
        repository: repositoryParam(),
        filePath: z.string().describe("Path to the file in the repository."),
        branch: z.string().describe("Target branch name."),
        content: z.string().describe("Full new file content as a string."),
        message: z.string().describe("Commit message."),
        sourceCommitId: z
          .string()
          .optional()
          .describe(
            "Current commit ID for optimistic locking. If provided and the branch has advanced, the request will fail with a 409 conflict.",
          ),
        sourceBranch: z
          .string()
          .optional()
          .describe("Fork point branch when creating a new branch."),
      }),
      annotations: toolAnnotations({
        readOnlyHint: false,
        idempotentHint: false,
      }),
    },
    async (params) => formatResponse(await bb.repositories.editFile(params)),
  );

  server.registerTool(
    "get_file_blame",
    {
      description:
        "Get blame/history information for a file. Returns line-by-line commit authorship data.",
      inputSchema: z.strictObject({
        project: projectParam(),
        repository: repositoryParam(),
        filePath: z.string().describe("Path to the file in the repository."),
        branch: z
          .string()
          .optional()
          .describe("Branch or commit hash (default: default branch)."),
      }),
      annotations: toolAnnotations(),
    },
    async (params) => formatResponse(await bb.repositories.getBlame(params)),
  );

  server.registerTool(
    "create_repository",
    {
      description: "Create a new repository in a project.",
      inputSchema: z.strictObject({
        project: projectParam(),
        name: z.string().describe("Repository name."),
        description: z.string().optional().describe("Repository description."),
        defaultBranch: z
          .string()
          .optional()
          .describe("Default branch name (defaults to 'main' if not set)."),
      }),
      annotations: toolAnnotations({
        readOnlyHint: false,
        idempotentHint: false,
      }),
    },
    async (params) => {
      const data = await bb.repositories.create(params);

      return formatResponse(curateResponse(data, DEFAULT_REPOSITORY_FIELDS));
    },
  );

  server.registerTool(
    "delete_repository",
    {
      description: "Delete a repository. This action is irreversible.",
      inputSchema: z.strictObject({
        project: projectParam(),
        repository: repositoryParam(),
      }),
      annotations: toolAnnotations({
        readOnlyHint: false,
        destructiveHint: true,
        idempotentHint: false,
      }),
    },
    async (params) => formatResponse(await bb.repositories.delete(params)),
  );
}
