import { describe, test, expect, beforeAll, afterAll } from "vitest";
import {
  startBitbucket,
  type StartedBitbucket,
} from "./bitbucket-container.js";
import { bootstrap, type Scenario } from "./bootstrap.js";
import { setupMcpAgainst, type McpAgainstBitbucket } from "./mcp-harness.js";
import { callAndParse } from "../tool-test-utils.js";
import { SELECTED_VERSIONS } from "./versions.js";

describe.each(SELECTED_VERSIONS)(
  "pull requests: Bitbucket $name",
  (version) => {
    let bb: StartedBitbucket;
    let mcp: McpAgainstBitbucket;
    let s: Scenario;

    beforeAll(async () => {
      bb = await startBitbucket(version);
      s = await bootstrap(bb.api);
      mcp = await setupMcpAgainst(bb);
    }, 420_000);

    afterAll(async () => {
      await mcp?.close();
      await bb?.stop();
    });

    test("get_pull_request_commits returns data", async () => {
      const r = await callAndParse<{ total: number }>(
        mcp.client,
        "get_pull_request_commits",
        {
          project: s.projectKey,
          repository: s.repoSlug,
          prId: s.prId,
          limit: 1,
        },
      );
      expect(typeof r.total).toBe("number");
    });

    test("create_pull_request with draft:true", async () => {
      const form = new FormData();
      form.append("content", "draft\n");
      form.append("message", "draft branch");
      form.append("branch", "draft-br");
      form.append("sourceBranch", "main");
      await bb.api.put(
        `projects/${s.projectKey}/repos/${s.repoSlug}/browse/draft.md`,
        { body: form },
      );

      const r = await callAndParse<{ id: number }>(
        mcp.client,
        "create_pull_request",
        {
          project: s.projectKey,
          repository: s.repoSlug,
          title: "Draft PR " + Date.now(),
          sourceBranch: "draft-br",
          targetBranch: "main",
          draft: true,
        },
      );
      const pr = await bb.api
        .get(
          `projects/${s.projectKey}/repos/${s.repoSlug}/pull-requests/${r.id}`,
        )
        .json<{ version: number }>();
      await bb.api
        .post(
          `projects/${s.projectKey}/repos/${s.repoSlug}/pull-requests/${r.id}/decline`,
          { json: { version: pr.version } },
        )
        .catch(() => {});
    });
  },
);
