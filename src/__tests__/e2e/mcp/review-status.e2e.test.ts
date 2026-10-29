import { expect } from "vitest";
import { callAndParse, callRaw } from "../../fixtures/tool-test-utils.js";
import { test, describeBitbucket } from ".././e2e-suite.js";

describeBitbucket("review status", () => {
  test("a reviewer sets NEEDS_WORK with inferred identity", async ({
    spawnMcp,
    scenario,
  }) => {
    const reviewer = await scenario.project.repo.reviewer;

    const pr = await scenario.project.repo.pr;
    const session = await spawnMcp(reviewer);

    const set = await callAndParse<{
      status: string;
      approved: boolean;
      role: string;
      lastReviewedCommit: string;
      user: { name: string };
    }>(session.client, "manage_review", {
      action: "status",
      project: scenario.project.key,
      repository: scenario.project.repo.slug,
      prId: pr.id,
      status: "NEEDS_WORK",
    });
    expect(set.status).toBe("NEEDS_WORK");
    expect(set.approved).toBe(false);
    // REPO_WRITE users join as REVIEWER; Bitbucket derives the role from
    // the repo permission, not from this call.
    expect(set.role).toBe("REVIEWER");
    expect(set.user.name).toBe(reviewer.username);
    expect(set.lastReviewedCommit).toBe(
      await scenario.project.repo.branches.feature.firstCommit.id,
    );
  });

  test("the author cannot set their own status", async ({ mcp, scenario }) => {
    const pr = await scenario.project.repo.pr;
    const result = await callRaw(mcp.client, "manage_review", {
      action: "status",
      project: scenario.project.key,
      repository: scenario.project.repo.slug,
      prId: pr.id,
      userSlug: "admin",
      status: "NEEDS_WORK",
    });
    expect(result.isError).toBe(true);
    expect(result.content[0].text).toContain(
      "Authors may not update their status",
    );
  });
});
