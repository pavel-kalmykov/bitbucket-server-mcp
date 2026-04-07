import { z } from "zod";
import type { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import type { ApiClients } from "../client.js";

function resolveProject(
  provided: string | undefined,
  defaultProject?: string,
): string {
  const project = provided || defaultProject;
  if (!project) throw new Error("Project is required.");
  return project;
}

export function registerPrompts(
  server: McpServer,
  clients: ApiClients,
  defaultProject?: string,
) {
  server.registerPrompt(
    "review-pr",
    {
      description:
        "Fetch all context needed to review a pull request: details, diff, comments, and CI results.",
      argsSchema: {
        project: z
          .string()
          .optional()
          .describe("Project key. Defaults to BITBUCKET_DEFAULT_PROJECT."),
        repository: z.string().describe("Repository slug."),
        prId: z.string().describe("Pull request ID."),
      },
    },
    async ({ project, repository, prId }) => {
      const resolvedProject = resolveProject(project, defaultProject);
      const prIdNum = parseInt(prId, 10);
      const basePath = `projects/${resolvedProject}/repos/${repository}/pull-requests/${prIdNum}`;

      const [prData, diffData, activitiesData, insightsData] =
        await Promise.all([
          clients.api.get(basePath).json<Record<string, unknown>>(),
          clients.api
            .get(`${basePath}/diff`, {
              searchParams: { contextLines: 10, withComments: false },
            })
            .json<Record<string, unknown>>(),
          clients.api
            .get(`${basePath}/activities`)
            .json<{ values: unknown[] }>(),
          clients.insights
            .get(`${basePath}/reports`)
            .json<{ values: unknown[] }>()
            .catch(() => ({ values: [] })),
        ]);

      const title = prData.title ?? "Unknown";
      const author =
        (
          (prData.author as Record<string, unknown>)?.user as Record<
            string,
            unknown
          >
        )?.displayName ?? "Unknown";
      const description = prData.description ?? "No description";
      const state = prData.state ?? "UNKNOWN";

      const comments = (activitiesData.values ?? []).filter(
        (a: unknown) => (a as Record<string, unknown>).action === "COMMENTED",
      );

      const sections = [
        `# Pull Request #${prIdNum}: ${title}`,
        `**Author:** ${author} | **State:** ${state}`,
        "",
        "## Description",
        String(description),
        "",
        "## Diff",
        "```",
        JSON.stringify(diffData, null, 2).slice(0, 5000),
        "```",
        "",
        `## Comments (${comments.length})`,
        comments.length > 0
          ? JSON.stringify(comments, null, 2).slice(0, 3000)
          : "No comments yet.",
        "",
        `## CI Reports (${insightsData.values.length})`,
        insightsData.values.length > 0
          ? JSON.stringify(insightsData.values, null, 2).slice(0, 2000)
          : "No CI reports available.",
      ];

      return {
        messages: [
          {
            role: "user" as const,
            content: { type: "text" as const, text: sections.join("\n") },
          },
        ],
      };
    },
  );
}
