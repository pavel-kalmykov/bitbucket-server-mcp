import type { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";

export function registerPrompts(server: McpServer) {
  server.registerPrompt(
    "review-pr",
    {
      description:
        "Step-by-step workflow for reviewing a Bitbucket pull request.",
    },
    async () => ({
      messages: [
        {
          role: "user" as const,
          content: {
            type: "text" as const,
            text: `Review a Bitbucket pull request. Follow these steps:

1. Ask me which PR to review (project, repository, and PR ID).
2. Use get_pull_request to get the PR details (title, author, description, reviewers, branches).
3. Use get_diff to see the changes. Start with a small contextLines value. If the diff is large, focus on specific files.
4. For any file where the diff context is not enough to understand the change, read the full file locally from the PR's source branch using git checkout or filesystem tools.
5. Use get_pr_activity with filter "comments" to see existing review comments and whether they have been addressed.
6. Use get_code_insights to check CI status (SonarQube, security scans, test results).
7. Create your review comments with manage_comment using state: PENDING (draft). Use severity: BLOCKER for issues that must be fixed before merging. Use filePath/line for inline comments, or parentId to reply to existing threads.
8. When all comments are ready, use submit_review with action: publish to make them visible at once. Set participantStatus to APPROVED or NEEDS_WORK.`,
          },
        },
      ],
    }),
  );
}
