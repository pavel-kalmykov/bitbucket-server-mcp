import { describe, test, expect, beforeAll, afterAll } from "vitest";
import {
  VERSIONS_WITH_THREAD_RESOLVED,
  VERSIONS_WITHOUT_THREAD_RESOLVED,
} from "./versions.js";
import {
  startBitbucket,
  type StartedBitbucket,
} from "./bitbucket-container.js";
import { bootstrap, createComment, type Scenario } from "./bootstrap.js";
import { setupMcpAgainst, type McpAgainstBitbucket } from "./mcp-harness.js";
import { callAndParse } from "../tool-test-utils.js";

interface CommentPayload {
  id: number;
  version: number;
  state: "OPEN" | "PENDING" | "RESOLVED";
  severity: "NORMAL" | "BLOCKER";
  threadResolved?: boolean;
}

/**
 * Two mirrored suites (one per supported / unsupported partition) keep
 * the assertions unconditional. The "supported" suite expects
 * threadResolved to round-trip via the edit PUT; the "unsupported" suite
 * expects the server to silently swallow the field (the Bitbucket API
 * tolerates unknown properties), so the MCP can forward it without a
 * per-version branch of its own.
 *
 * Mutations go through the MCP client (`manage_comment`) so zod
 * validation, handler serialisation, and `formatResponse` are all part
 * of what the test exercises. The raw ky client on `bb.api` is only
 * used for setup (creating the seed comment, provisioning the repo),
 * which the MCP does not expose as tools.
 */
describe.each(VERSIONS_WITH_THREAD_RESOLVED)(
  "threadResolved supported: Bitbucket $name",
  (version) => {
    let bb: StartedBitbucket;
    let mcp: McpAgainstBitbucket;
    let scenario: Scenario;

    beforeAll(async () => {
      bb = await startBitbucket(version);
      scenario = await bootstrap(bb.api);
      mcp = await setupMcpAgainst(bb);
    }, 420_000);

    afterAll(async () => {
      await mcp?.close();
      await bb?.stop();
    });

    test("fresh comment starts with threadResolved=false", async () => {
      const c = await createComment(bb.api, scenario, "needs review");
      expect(c.threadResolved).toBe(false);
    });

    test("manage_comment edit {threadResolved:true} flips the flag without touching state/severity", async () => {
      const c = await createComment(bb.api, scenario, "please look");
      const updated = await callAndParse<CommentPayload>(
        mcp.client,
        "manage_comment",
        {
          action: "edit",
          project: scenario.projectKey,
          repository: scenario.repoSlug,
          prId: scenario.prId,
          commentId: c.id,
          version: c.version,
          threadResolved: true,
        },
      );
      expect(updated.threadResolved).toBe(true);
      expect(updated.state).toBe(c.state);
      expect(updated.severity).toBe(c.severity);
    });

    test("manage_comment edit {state:RESOLVED, threadResolved:true} updates both in one call", async () => {
      const c = await createComment(bb.api, scenario, "fix this");
      // Promote to BLOCKER first so `state: RESOLVED` has something to
      // toggle; both steps go through the MCP tool.
      const blocker = await callAndParse<CommentPayload>(
        mcp.client,
        "manage_comment",
        {
          action: "edit",
          project: scenario.projectKey,
          repository: scenario.repoSlug,
          prId: scenario.prId,
          commentId: c.id,
          version: c.version,
          severity: "BLOCKER",
        },
      );
      const resolved = await callAndParse<CommentPayload>(
        mcp.client,
        "manage_comment",
        {
          action: "edit",
          project: scenario.projectKey,
          repository: scenario.repoSlug,
          prId: scenario.prId,
          commentId: c.id,
          version: blocker.version,
          state: "RESOLVED",
          threadResolved: true,
        },
      );
      expect(resolved.state).toBe("RESOLVED");
      expect(resolved.threadResolved).toBe(true);
    });
  },
);

describe.each(VERSIONS_WITHOUT_THREAD_RESOLVED)(
  "threadResolved unsupported: Bitbucket $name",
  (version) => {
    let bb: StartedBitbucket;
    let mcp: McpAgainstBitbucket;
    let scenario: Scenario;

    beforeAll(async () => {
      bb = await startBitbucket(version);
      scenario = await bootstrap(bb.api);
      mcp = await setupMcpAgainst(bb);
    }, 420_000);

    afterAll(async () => {
      await mcp?.close();
      await bb?.stop();
    });

    test("fresh comment omits the threadResolved field", async () => {
      const c = await createComment(bb.api, scenario, "hey");
      expect(c.threadResolved).toBeUndefined();
    });

    test("manage_comment edit {threadResolved:true} is silently ignored (server returns 200, field absent)", async () => {
      const c = await createComment(bb.api, scenario, "check");
      const updated = await callAndParse<CommentPayload>(
        mcp.client,
        "manage_comment",
        {
          action: "edit",
          project: scenario.projectKey,
          repository: scenario.repoSlug,
          prId: scenario.prId,
          commentId: c.id,
          version: c.version,
          threadResolved: true,
        },
      );
      expect(updated.threadResolved).toBeUndefined();
    });
  },
);
