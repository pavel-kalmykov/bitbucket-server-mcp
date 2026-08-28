import type { ApiContext } from "./context.js";
import { resolveProject } from "./context.js";
import { getPaginated } from "./http/client.js";
import type { Paginated } from "../response/validate.js";

export interface ListRepositoriesParams {
  project?: string;
  limit?: number;
  start?: number;
}

export interface BrowseParams {
  project?: string;
  repository: string;
  path?: string;
  branch?: string;
  limit?: number;
}

export interface GetFileParams {
  project?: string;
  repository: string;
  filePath: string;
  branch?: string;
  limit?: number;
  start?: number;
}

export interface GetBlameParams {
  project?: string;
  repository: string;
  filePath: string;
  branch?: string;
}

export interface UploadAttachmentParams {
  project?: string;
  repository: string;
  fileName: string;
  data: Blob;
}

export interface Attachment {
  id: number;
  url: string;
  links: { self: { href: string }; attachment: { href: string } };
}

export interface EditFileParams {
  project?: string;
  repository: string;
  filePath: string;
  branch: string;
  content: string;
  message: string;
  sourceCommitId?: string;
  sourceBranch?: string;
}

export interface CreateRepositoryParams {
  project?: string;
  name: string;
  description?: string;
  defaultBranch?: string;
}

export interface DeleteRepositoryParams {
  project?: string;
  repository: string;
}

export function repositoriesApi(ctx: ApiContext) {
  const repoPath = (project: string | undefined, repository: string) =>
    `projects/${resolveProject(ctx, project)}/repos/${repository}`;

  return {
    async list({
      project,
      limit = 25,
      start = 0,
    }: ListRepositoriesParams): Promise<Paginated<Record<string, unknown>>> {
      return getPaginated(
        ctx.http.api,
        `projects/${resolveProject(ctx, project)}/repos`,
        { searchParams: { limit, start } },
      );
    },

    async browse({
      project,
      repository,
      path,
      branch,
      limit = 50,
    }: BrowseParams): Promise<unknown> {
      const base = `${repoPath(project, repository)}/browse`;
      const searchParams: Record<string, string | number> = { limit };
      if (branch) searchParams.at = branch;

      return ctx.http.api
        .get(path ? `${base}/${path}` : base, { searchParams })
        .json();
    },

    async getFile({
      project,
      repository,
      filePath,
      branch,
      limit = 100,
      start = 0,
    }: GetFileParams): Promise<unknown> {
      const searchParams: Record<string, string | number> = { limit, start };
      if (branch) searchParams.at = branch;

      return ctx.http.api
        .get(`${repoPath(project, repository)}/browse/${filePath}`, {
          searchParams,
        })
        .json();
    },

    async getBlame({
      project,
      repository,
      filePath,
      branch,
    }: GetBlameParams): Promise<unknown> {
      const searchParams: Record<string, string> = { blame: "" };
      if (branch) searchParams.at = branch;

      return ctx.http.api
        .get(`${repoPath(project, repository)}/browse/${filePath}`, {
          searchParams,
        })
        .json();
    },

    async uploadAttachment({
      project,
      repository,
      fileName,
      data,
    }: UploadAttachmentParams): Promise<Attachment> {
      const body = new FormData();
      body.append("files", data, fileName);

      const response = await ctx.http.api
        .post(`${repoPath(project, repository)}/attachments`, { body })
        .json<{ attachments: Attachment[] }>();

      return response.attachments[0];
    },

    async editFile({
      project,
      repository,
      filePath,
      branch,
      content,
      message,
      sourceCommitId,
      sourceBranch,
    }: EditFileParams): Promise<unknown> {
      const body = new FormData();
      body.append("branch", branch);
      body.append("content", content);
      body.append("message", message);
      if (sourceCommitId) body.append("sourceCommitId", sourceCommitId);
      if (sourceBranch) body.append("sourceBranch", sourceBranch);

      return ctx.http.api
        .put(`${repoPath(project, repository)}/browse/${filePath}`, { body })
        .json();
    },

    async create({
      project,
      name,
      description,
      defaultBranch,
    }: CreateRepositoryParams): Promise<Record<string, unknown>> {
      const json: Record<string, unknown> = { name };
      if (description) json.description = description;
      if (defaultBranch) json.defaultBranch = defaultBranch;

      return ctx.http.api
        .post(`projects/${resolveProject(ctx, project)}/repos`, { json })
        .json<Record<string, unknown>>();
    },

    async delete({
      project,
      repository,
    }: DeleteRepositoryParams): Promise<{ deleted: true; repository: string }> {
      await ctx.http.api.delete(repoPath(project, repository));
      return { deleted: true, repository };
    },
  };
}

export type RepositoriesApi = ReturnType<typeof repositoriesApi>;
