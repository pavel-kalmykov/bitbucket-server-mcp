import { formatResponse } from "../response/format.js";
import { toolAnnotations } from "../response/annotations.js";
import type { ToolContext } from "./shared.js";
import { projectParam, repositoryParam, fieldsParam } from "./params.js";
import {
  curateList,
  DEFAULT_SECRET_SCANNING_FIELDS,
} from "../response/curate.js";
import { listSecretScanningRules } from "../api/admin.js";

export function registerSecretScanningTools(ctx: ToolContext) {
  const { server, clients } = ctx;

  server.registerTool(
    "list_secret_scanning_rules",
    {
      description:
        "List secret scanning allowlist rules for a repository. Requires Bitbucket Server 8.5+.",
      inputSchema: {
        project: projectParam(),
        repository: repositoryParam(),
        fields: fieldsParam(),
      },
      annotations: toolAnnotations(),
    },
    async ({ project, repository, fields }) => {
      const resolvedProject = ctx.resolveProject(project);
      const data = await listSecretScanningRules(
        clients,
        resolvedProject,
        repository,
      );
      return formatResponse(
        curateList(data, fields ?? DEFAULT_SECRET_SCANNING_FIELDS),
      );
    },
  );
}
