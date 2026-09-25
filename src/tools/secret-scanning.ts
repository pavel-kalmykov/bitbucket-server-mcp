import { formatResponse } from "../response/format.js";
import { toolAnnotations } from "../response/annotations.js";
import type { ToolContext } from "./shared.js";
import { projectParam, repositoryParam, fieldsParam } from "./params.js";
import {
  curateList,
  DEFAULT_SECRET_SCANNING_FIELDS,
} from "../response/curate.js";

export function registerSecretScanningTools(ctx: ToolContext) {
  const { server, bb } = ctx;

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
    async ({ fields, ...params }) => {
      const rules = await bb.secretScanning.list(params);

      return formatResponse(
        curateList(rules, fields ?? DEFAULT_SECRET_SCANNING_FIELDS),
      );
    },
  );
}
