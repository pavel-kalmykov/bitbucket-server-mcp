import { describe, test, expect, beforeAll, afterAll } from "vitest";
import { Client } from "@modelcontextprotocol/sdk/client/index.js";
import { InMemoryTransport } from "@modelcontextprotocol/sdk/inMemory.js";
import type { Tool, ToolAnnotations } from "@modelcontextprotocol/sdk/types.js";
import { createServer } from "../../server.js";

let client: Client;
let serverTransport: ReturnType<typeof InMemoryTransport.createLinkedPair>[1];
let allTools: Tool[];

beforeAll(async () => {
  const { server } = createServer({
    baseUrl: "http://localhost",
    token: "fake",
  });
  const [clientTransport, sTransport] = InMemoryTransport.createLinkedPair();
  client = new Client(
    { name: "test-client", version: "1.0.0" },
    { capabilities: {} },
  );
  await Promise.all([
    server.connect(sTransport),
    client.connect(clientTransport),
  ]);
  serverTransport = sTransport;
  const { tools } = await client.listTools();
  allTools = tools;
});

afterAll(async () => {
  await client.close();
  await serverTransport.close();
});

function getTool(name: string): Tool {
  const tool = allTools.find((t) => t.name === name);
  expect(tool).toBeDefined();
  return tool!;
}

function getProp(tool: Tool, field: string) {
  return tool.inputSchema.properties?.[field] as
    | Record<string, unknown>
    | undefined;
}

describe("Tool schema contract: descriptions", () => {
  test.each<{ name: string; contains: string }>([
    { name: "create_pull_request", contains: "cross-repo" },
    { name: "get_pull_request", contains: "details" },
    { name: "update_pull_request", contains: "reviewers" },
    { name: "merge_pull_request", contains: "optimistic locking" },
    { name: "decline_pull_request", contains: "optimistic locking" },
    { name: "list_pull_requests", contains: "filtering" },
    { name: "get_dashboard_pull_requests", contains: "dashboard" },
    { name: "get_pr_activity", contains: "activity" },
    { name: "get_diff", contains: "stat=true" },
    { name: "list_projects", contains: "project keys" },
    { name: "list_repositories", contains: "repository slugs" },
    { name: "browse_repository", contains: "project structure" },
    { name: "get_file_content", contains: "pagination" },
    { name: "upload_attachment", contains: "markdown reference" },
    { name: "get_server_info", contains: "version" },
    { name: "list_branches", contains: "default branch" },
    { name: "list_commits", contains: "author" },
    { name: "manage_branches", contains: "create a new branch" },
    { name: "get_commit", contains: "commit by its ID" },
    { name: "manage_comment", contains: "inline" },
    { name: "search_emoticons", contains: "shortcut" },
    { name: "submit_review", contains: "approve" },
    { name: "search", contains: "code or files" },
    { name: "get_code_insights", contains: "annotations" },
    { name: "get_build_status", contains: "commit" },
  ])("$name description mentions '$contains'", ({ name, contains }) => {
    const tool = getTool(name);
    expect(tool.description).toContain(contains);
  });
});

describe("Tool schema contract: required fields", () => {
  test.each<{ name: string; required: string[] }>([
    {
      name: "create_pull_request",
      required: ["repository", "title", "sourceBranch", "targetBranch"],
    },
    { name: "get_pull_request", required: ["repository", "prId"] },
    { name: "update_pull_request", required: ["repository", "prId"] },
    { name: "merge_pull_request", required: ["repository", "prId"] },
    { name: "decline_pull_request", required: ["repository", "prId"] },
    { name: "list_pull_requests", required: ["repository"] },
    { name: "get_pr_activity", required: ["repository", "prId"] },
    { name: "get_diff", required: ["repository", "prId"] },
    { name: "browse_repository", required: ["repository"] },
    { name: "get_file_content", required: ["repository", "filePath"] },
    { name: "upload_attachment", required: ["repository", "filePath"] },
    { name: "list_branches", required: ["repository"] },
    { name: "list_commits", required: ["repository"] },
    { name: "manage_branches", required: ["action", "repository", "branch"] },
    { name: "get_commit", required: ["repository", "commitId"] },
    { name: "manage_comment", required: ["action", "repository", "prId"] },
    { name: "search_emoticons", required: ["query"] },
    { name: "submit_review", required: ["action", "repository", "prId"] },
    { name: "search", required: ["query"] },
    { name: "get_code_insights", required: ["repository", "pullRequestId"] },
  ])("$name requires $required", ({ name, required }) => {
    const tool = getTool(name);
    expect(tool.inputSchema.required).toEqual(expect.arrayContaining(required));
  });
});

describe("Tool schema contract: field descriptions", () => {
  test.each<{ tool: string; field: string; contains: string }>([
    {
      tool: "create_pull_request",
      field: "sourceProject",
      contains: "cross-repo",
    },
    {
      tool: "create_pull_request",
      field: "includeDefaultReviewers",
      contains: "default",
    },
    { tool: "merge_pull_request", field: "strategy", contains: "no-ff" },
    {
      tool: "merge_pull_request",
      field: "message",
      contains: "commit message",
    },
    { tool: "decline_pull_request", field: "message", contains: "declining" },
    { tool: "list_pull_requests", field: "state", contains: "OPEN" },
    { tool: "list_pull_requests", field: "author", contains: "username" },
    {
      tool: "get_dashboard_pull_requests",
      field: "participantStatus",
      contains: "participant",
    },
    {
      tool: "get_dashboard_pull_requests",
      field: "closedSince",
      contains: "epoch",
    },
    { tool: "get_pr_activity", field: "filter", contains: "Filter activity" },
    { tool: "get_pr_activity", field: "excludeUsers", contains: "bot" },
    { tool: "get_diff", field: "stat", contains: "summary" },
    { tool: "get_diff", field: "filePath", contains: "specific file" },
    { tool: "get_diff", field: "maxLinesPerFile", contains: "0 = no limit" },
    { tool: "manage_comment", field: "severity", contains: "BLOCKER" },
    { tool: "manage_comment", field: "state", contains: "PENDING" },
    { tool: "manage_comment", field: "parentId", contains: "threaded" },
    { tool: "manage_comment", field: "filePath", contains: "inline" },
    { tool: "submit_review", field: "action", contains: "Review action" },
    {
      tool: "submit_review",
      field: "participantStatus",
      contains: "publish action",
    },
    { tool: "search", field: "type", contains: "code" },
    { tool: "search", field: "repository", contains: "scope" },
    { tool: "get_build_status", field: "prId", contains: "latest commit" },
    { tool: "get_build_status", field: "commitId", contains: "commit hash" },
    { tool: "list_commits", field: "author", contains: "case-insensitive" },
    { tool: "manage_branches", field: "action", contains: "Operation" },
    { tool: "manage_branches", field: "startPoint", contains: "branch from" },
    { tool: "get_commit", field: "commitId", contains: "commit hash" },
    {
      tool: "upload_attachment",
      field: "filePath",
      contains: "local filesystem",
    },
  ])("$tool.$field describes '$contains'", ({ tool, field, contains }) => {
    const t = getTool(tool);
    const prop = getProp(t, field);
    expect(prop).toBeDefined();
    expect(prop!.description).toContain(contains);
  });
});

describe("Tool schema contract: enum values", () => {
  test.each<{ tool: string; field: string; enums: string[] }>([
    {
      tool: "list_pull_requests",
      field: "state",
      enums: ["OPEN", "MERGED", "DECLINED", "ALL"],
    },
    {
      tool: "list_pull_requests",
      field: "direction",
      enums: ["INCOMING", "OUTGOING"],
    },
    { tool: "list_pull_requests", field: "order", enums: ["OLDEST", "NEWEST"] },
    {
      tool: "get_dashboard_pull_requests",
      field: "state",
      enums: ["OPEN", "MERGED", "DECLINED", "ALL"],
    },
    {
      tool: "get_dashboard_pull_requests",
      field: "role",
      enums: ["AUTHOR", "REVIEWER", "PARTICIPANT"],
    },
    {
      tool: "get_dashboard_pull_requests",
      field: "participantStatus",
      enums: ["APPROVED", "UNAPPROVED", "NEEDS_WORK"],
    },
    {
      tool: "get_dashboard_pull_requests",
      field: "order",
      enums: ["OLDEST", "NEWEST"],
    },
    {
      tool: "get_pr_activity",
      field: "filter",
      enums: ["all", "reviews", "comments"],
    },
    {
      tool: "manage_comment",
      field: "action",
      enums: ["create", "edit", "delete", "react", "unreact"],
    },
    {
      tool: "manage_comment",
      field: "state",
      enums: ["OPEN", "PENDING", "RESOLVED"],
    },
    { tool: "manage_comment", field: "severity", enums: ["NORMAL", "BLOCKER"] },
    {
      tool: "manage_comment",
      field: "lineType",
      enums: ["ADDED", "REMOVED", "CONTEXT"],
    },
    {
      tool: "manage_comment",
      field: "diffType",
      enums: ["EFFECTIVE", "RANGE", "COMMIT"],
    },
    { tool: "manage_comment", field: "fileType", enums: ["TO", "FROM"] },
    {
      tool: "submit_review",
      field: "action",
      enums: ["approve", "unapprove", "publish"],
    },
    {
      tool: "submit_review",
      field: "participantStatus",
      enums: ["APPROVED", "NEEDS_WORK"],
    },
    { tool: "search", field: "type", enums: ["code", "file"] },
    {
      tool: "merge_pull_request",
      field: "strategy",
      enums: [
        "no-ff",
        "ff",
        "ff-only",
        "squash",
        "squash-ff-only",
        "rebase-no-ff",
        "rebase-ff-only",
      ],
    },
  ])("$tool.$field has enum $enums", ({ tool, field, enums }) => {
    const t = getTool(tool);
    const prop = getProp(t, field);
    expect(prop).toBeDefined();
    expect(prop!.enum).toEqual(enums);
  });
});

describe("Tool schema contract: annotations", () => {
  test.each<{ name: string; expected: Partial<ToolAnnotations> }>([
    { name: "list_projects", expected: { readOnlyHint: true } },
    { name: "get_pull_request", expected: { readOnlyHint: true } },
    { name: "get_diff", expected: { readOnlyHint: true } },
    { name: "search", expected: { readOnlyHint: true, openWorldHint: true } },
    {
      name: "create_pull_request",
      expected: { readOnlyHint: false, idempotentHint: false },
    },
    { name: "update_pull_request", expected: { readOnlyHint: false } },
    {
      name: "merge_pull_request",
      expected: {
        readOnlyHint: false,
        destructiveHint: true,
        idempotentHint: false,
      },
    },
    {
      name: "decline_pull_request",
      expected: {
        readOnlyHint: false,
        destructiveHint: true,
        idempotentHint: false,
      },
    },
    {
      name: "manage_comment",
      expected: { readOnlyHint: false, idempotentHint: false },
    },
    {
      name: "submit_review",
      expected: { readOnlyHint: false, idempotentHint: false },
    },
    {
      name: "manage_branches",
      expected: {
        readOnlyHint: false,
        destructiveHint: true,
        idempotentHint: false,
      },
    },
    {
      name: "get_commit",
      expected: { readOnlyHint: true, idempotentHint: true },
    },
    {
      name: "upload_attachment",
      expected: { readOnlyHint: false, idempotentHint: false },
    },
  ])("$name has annotations $expected", ({ name, expected }) => {
    const tool = getTool(name);
    expect(tool.annotations).toBeDefined();
    expect(tool.annotations).toMatchObject(expected);
  });
});

describe("Tool schema contract: field types", () => {
  test.each<{ tool: string; field: string; type: string }>([
    { tool: "create_pull_request", field: "repository", type: "string" },
    { tool: "create_pull_request", field: "reviewers", type: "array" },
    {
      tool: "create_pull_request",
      field: "includeDefaultReviewers",
      type: "boolean",
    },
    { tool: "get_pull_request", field: "prId", type: "number" },
    { tool: "get_diff", field: "stat", type: "boolean" },
    { tool: "get_diff", field: "contextLines", type: "number" },
    { tool: "list_pull_requests", field: "limit", type: "number" },
    { tool: "browse_repository", field: "path", type: "string" },
  ])("$tool.$field has type '$type'", ({ tool, field, type }) => {
    const prop = getProp(getTool(tool), field);
    expect(prop).toBeDefined();
    expect(prop!.type).toBe(type);
  });
});

describe("Tool schema contract: optional fields", () => {
  test.each<{ tool: string; field: string }>([
    { tool: "create_pull_request", field: "project" },
    { tool: "create_pull_request", field: "sourceProject" },
    { tool: "list_pull_requests", field: "state" },
    { tool: "list_pull_requests", field: "author" },
    { tool: "get_diff", field: "stat" },
    { tool: "get_diff", field: "filePath" },
    { tool: "browse_repository", field: "branch" },
    { tool: "browse_repository", field: "path" },
  ])("$tool.$field is optional (not in required)", ({ tool, field }) => {
    const t = getTool(tool);
    expect(t.inputSchema.required).not.toContain(field);
  });
});

describe("Tool schema contract: server instructions", () => {
  test("instructions mention key read tools and concepts", async () => {
    const instructions = await client.getInstructions();
    const mentioned = [
      "list_projects",
      "list_repositories",
      "get_diff",
      "get_pr_activity",
      "get_build_status",
      "manage_comment",
      "submit_review",
      "upload_attachment",
      "create_pull_request",
    ];
    const missing = mentioned.filter((t) => !instructions!.includes(t));
    expect(missing).toEqual([]);
  });

  test("instructions describe the fields parameter and curation", async () => {
    const instructions = await client.getInstructions();
    expect(instructions).toContain("fields");
    expect(instructions).toContain("*all");
  });

  test("instructions mention BITBUCKET_DEFAULT_PROJECT", async () => {
    const instructions = await client.getInstructions();
    expect(instructions).toContain("BITBUCKET_DEFAULT_PROJECT");
  });

  test("instructions mention severity BLOCKER for tasks", async () => {
    const instructions = await client.getInstructions();
    expect(instructions).toContain("BLOCKER");
  });

  test("instructions mention stat=true for diff summary", async () => {
    const instructions = await client.getInstructions();
    expect(instructions).toContain("stat=true");
  });
});

describe("Tool schema contract: every field has a non-empty description", () => {
  const toolsWithoutInputSchema = new Set(["get_server_info"]);

  test("every tool's input fields have non-empty descriptions", async () => {
    const { tools } = await client.listTools();
    const withSchema = tools.filter(
      (t) => !toolsWithoutInputSchema.has(t.name),
    );

    for (const tool of withSchema) {
      const props = tool.inputSchema.properties ?? {};
      const fields = Object.entries(props) as [
        string,
        Record<string, unknown>,
      ][];

      expect(fields.length, `${tool.name} has no input fields`).toBeGreaterThan(
        0,
      );
      for (const [fieldName, schema] of fields) {
        expect(
          schema.description,
          `${tool.name}.${fieldName} has no description`,
        ).toBeDefined();
        expect(
          (schema.description as string).length,
          `${tool.name}.${fieldName} has empty description`,
        ).toBeGreaterThan(0);
      }
    }
  });
});

describe("Tool schema contract: all expected tools are registered", () => {
  test("every expected tool name is present", () => {
    const names = allTools.map((t) => t.name);
    const expected = [
      "list_projects",
      "list_repositories",
      "browse_repository",
      "get_file_content",
      "upload_attachment",
      "get_server_info",
      "list_branches",
      "list_commits",
      "manage_branches",
      "get_commit",
      "create_pull_request",
      "get_pull_request",
      "update_pull_request",
      "merge_pull_request",
      "decline_pull_request",
      "list_pull_requests",
      "get_dashboard_pull_requests",
      "get_pr_activity",
      "get_diff",
      "manage_comment",
      "search_emoticons",
      "submit_review",
      "search",
      "get_code_insights",
      "get_build_status",
    ];
    expect(new Set(names)).toEqual(new Set(expected));
  });
});
