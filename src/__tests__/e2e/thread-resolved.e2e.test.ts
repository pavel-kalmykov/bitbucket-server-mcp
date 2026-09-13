import { expect } from "vitest";
import { atLeast, THREAD_RESOLVED_SINCE } from "./versions.js";
import type { KyInstance } from "ky";
import { callAndParse } from "../tool-test-utils.js";
import { test, describeBitbucket, type ScenarioProject } from "./e2e-suite.js";
import type { RestComment } from "../../generated/types.js";

type CommentPayload = Pick<
  RestComment,
  "id" | "version" | "state" | "severity"
> & { threadResolved?: boolean };

type CreateCommentArgs = {
  api: KyInstance;
  scenario: { project: ScenarioProject };
  text: string;
};

async function createComment({
  api,
  scenario,
  text,
}: CreateCommentArgs): Promise<CommentPayload> {
  return api
    .post(
      `projects/${scenario.project.key}/repos/${scenario.project.repo.slug}/pull-requests/${(await scenario.project.repo.pr).id}/comments`,
      { json: { text } },
    )
    .json<CommentPayload>();
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

describeBitbucket(
  "threadResolved supported",
  () => {
    test("fresh comment starts with threadResolved=false", async ({
      bb,
      scenario,
    }) => {
      const c = await createComment({
        api: bb.api,
        scenario,
        text: "needs review",
      });
      expect(c.threadResolved).toBe(false);
    });

    test("manage_comment edit {threadResolved:true} flips the flag without touching state/severity", async ({
      bb,
      mcp,
      scenario,
    }) => {
      const c = await createComment({
        api: bb.api,
        scenario,
        text: "please look",
      });
      const updated = await callAndParse<CommentPayload>(
        mcp.client,
        "manage_comment",
        {
          action: "edit",
          project: scenario.project.key,
          repository: scenario.project.repo.slug,
          prId: (await scenario.project.repo.pr).id,
          commentId: c.id,
          version: c.version,
          threadResolved: true,
        },
      );
      expect(updated.threadResolved).toBe(true);
      expect(updated.state).toBe(c.state);
      expect(updated.severity).toBe(c.severity);
    });

    test("manage_comment edit {state:RESOLVED, threadResolved:true} updates both in one call", async ({
      bb,
      mcp,
      scenario,
    }) => {
      const c = await createComment({
        api: bb.api,
        scenario,
        text: "fix this",
      });
      // Promote to BLOCKER first so `state: RESOLVED` has something to
      // toggle; both steps go through the MCP tool.
      const blocker = await callAndParse<CommentPayload>(
        mcp.client,
        "manage_comment",
        {
          action: "edit",
          project: scenario.project.key,
          repository: scenario.project.repo.slug,
          prId: (await scenario.project.repo.pr).id,
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
          project: scenario.project.key,
          repository: scenario.project.repo.slug,
          prId: (await scenario.project.repo.pr).id,
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
  atLeast(THREAD_RESOLVED_SINCE),
);

describeBitbucket(
  "threadResolved unsupported",
  () => {
    test("fresh comment omits the threadResolved field", async ({
      bb,
      scenario,
    }) => {
      const c = await createComment({ api: bb.api, scenario, text: "hey" });
      expect(c.threadResolved).toBeUndefined();
    });

    test("manage_comment edit {threadResolved:true} is silently ignored (server returns 200, field absent)", async ({
      bb,
      mcp,
      scenario,
    }) => {
      const c = await createComment({ api: bb.api, scenario, text: "check" });
      const updated = await callAndParse<CommentPayload>(
        mcp.client,
        "manage_comment",
        {
          action: "edit",
          project: scenario.project.key,
          repository: scenario.project.repo.slug,
          prId: (await scenario.project.repo.pr).id,
          commentId: c.id,
          version: c.version,
          threadResolved: true,
        },
      );
      expect(updated.threadResolved).toBeUndefined();
    });
  },
  !atLeast(THREAD_RESOLVED_SINCE),
);
