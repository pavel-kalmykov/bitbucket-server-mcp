import { expect } from "vitest";
import {
  createBitbucketClient,
  type BitbucketClient,
} from "../../../api/client.js";
import type { StartedBitbucket } from ".././bitbucket-container.js";
import { test, describeBitbucket, type ScenarioUser } from ".././e2e-suite.js";

function adminClient(bb: StartedBitbucket): BitbucketClient {
  return createBitbucketClient({
    baseUrl: bb.url,
    username: bb.admin.username,
    password: bb.admin.password,
  });
}

function limitedClient(
  bb: StartedBitbucket,
  limited: ScenarioUser,
): BitbucketClient {
  return createBitbucketClient({
    baseUrl: bb.url,
    username: limited.username,
    password: limited.password,
  });
}

describeBitbucket("inbox", () => {
  test("L1: the author inbox lists the scenario pull request", async ({
    bb,
    scenario,
  }) => {
    const client = adminClient(bb);
    const prId = (await scenario.project.repo.pr).id;

    const page = await client.inbox.listPullRequests({
      role: "AUTHOR",
      limit: 50,
    });
    expect(page.values.map((pr) => pr.id)).toContain(prId);
  });

  test("L2+L3: reviewer partition filters until the review is requested", async ({
    bb,
    scenario,
  }) => {
    const admin = adminClient(bb);
    const limited = await scenario.project.repo.reviewer;
    const session = limitedClient(bb, limited);
    const pr = await scenario.project.repo.pr;

    // Before the review is requested, the limited user has no relation to
    // the pr and their reviewer inbox must not list it.
    const before = await session.inbox.listPullRequests({
      role: "REVIEWER",
      participantStatus: "UNAPPROVED",
      limit: 50,
    });
    expect(before.values.map((row) => row.id)).not.toContain(pr.id);

    // Requesting the review adds them as a reviewer; the same filtered
    // inbox must now list it.
    await admin.pullRequests.update({
      project: scenario.project.key,
      repository: scenario.project.repo.slug,
      prId: pr.id,
      reviewers: [limited.username],
    });
    const after = await session.inbox.listPullRequests({
      role: "REVIEWER",
      participantStatus: "UNAPPROVED",
      limit: 50,
    });
    expect(after.values.map((row) => row.id)).toContain(pr.id);
  });

  test("L4: limit=1 paginates instead of returning everything", async ({
    bb,
    scenario,
  }) => {
    const client = adminClient(bb);
    await scenario.project.repo.pr;

    // A second open pr from a different branch guarantees at least two
    // authored prs, making limit=1 a real boundary.
    await bb.api.post(
      `projects/${scenario.project.key}/repos/${scenario.project.repo.slug}/branches`,
      { json: { name: "inbox-boundary", startPoint: "feature" } },
    );
    await client.pullRequests.create({
      project: scenario.project.key,
      repository: scenario.project.repo.slug,
      title: "inbox pagination boundary",
      sourceBranch: "inbox-boundary",
      targetBranch: "main",
    });

    const page = await client.inbox.listPullRequests({
      role: "AUTHOR",
      limit: 1,
    });
    expect(page.values.length).toBeLessThanOrEqual(1);
    expect(page.isLastPage).toBe(false);
    expect(page.values[0]?.id).toBeDefined();
  });

  test("C1: the count excludes the author partition", async ({
    bb,
    scenario,
  }) => {
    const client = adminClient(bb);
    // The only pull requests in a fresh container are authored by the
    // admin fixture user, and Bitbucket does not count a pull request for
    // its own author: the count must stay at zero.
    await scenario.project.repo.pr;

    const count = await client.inbox.count();

    expect(count).toEqual({ count: 0 });
  });
});
