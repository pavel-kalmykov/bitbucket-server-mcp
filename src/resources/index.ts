import type { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import type { ApiClients } from "../http/client.js";
import type { ApiCache } from "../http/cache.js";

const FIELD_CATALOG = `Available fields in the Bitbucket API (common across entities):
- PR: id, version, title, description, state, open, closed, locked, createdDate, updatedDate, closedDate, fromRef.id, fromRef.displayId, fromRef.latestCommit, fromRef.repository.slug, fromRef.repository.project.key, toRef.id, toRef.displayId, toRef.latestCommit, toRef.repository.slug, toRef.repository.project.key, author.user.name, author.user.displayName, author.user.emailAddress, author.status, author.approved, reviewers[].user.name, reviewers[].user.displayName, reviewers[].status, reviewers[].approved, reviewers[].lastReviewedCommit, participants[].user.name, participants[].status, properties.commentCount, properties.openTaskCount, properties.resolvedTaskCount, properties.mergeResult.outcome, links.self[].href
- Project: key, id, name, description, type, public, links.self[].href
- Repository: slug, id, name, description, state, forkable, public, archived, project.key, project.name, origin.slug, origin.project.key, links.clone[].href, links.self[].href
- Branch: id, displayId, type, latestCommit, isDefault, metadata
- Commit: id, displayId, message, author.name, author.emailAddress, authorTimestamp, committerTimestamp, parents[].id`;

export function registerResources(
  server: McpServer,
  clients: ApiClients,
  cache: ApiCache,
) {
  server.registerResource(
    "projects",
    "bitbucket://projects",
    {
      description:
        "List of all accessible Bitbucket projects with their keys and names",
      mimeType: "application/json",
    },
    async () => {
      const cacheKey = "resource:projects";
      let projects = cache.get<unknown[]>(cacheKey);

      if (!projects) {
        const data = await clients.api
          .get("projects", {
            searchParams: { limit: 1000 },
          })
          .json<{ values: unknown[] }>();
        projects = data.values;
        cache.set(cacheKey, projects, 5 * 60 * 1000);
      }

      return {
        contents: [
          {
            uri: "bitbucket://projects",
            mimeType: "application/json" as const,
            text: JSON.stringify(projects),
          },
        ],
      };
    },
  );

  server.registerResource(
    "schema-fields",
    "bitbucket://schema/fields",
    {
      description:
        "Available response fields per entity type for the fields param",
      mimeType: "text/plain",
    },
    async (uri) => ({
      contents: [
        {
          uri: uri.toString(),
          mimeType: "text/plain" as const,
          text: FIELD_CATALOG,
        },
      ],
    }),
  );
}
