import { expect } from "vitest";
import {
  createBitbucketClient,
  type BitbucketClient,
} from "../../api/client.js";
import type { StartedBitbucket } from "./bitbucket-container.js";
import { test, describeBitbucket } from "./e2e-suite.js";

const LIMITED = {
  name: "limited-user",
  password: "Limited-2026!review",
} as const;

function adminClient(bb: StartedBitbucket): BitbucketClient {
  return createBitbucketClient({
    baseUrl: bb.url,
    username: bb.admin.username,
    password: bb.admin.password,
  });
}

function limitedClient(bb: StartedBitbucket): BitbucketClient {
  return createBitbucketClient({
    baseUrl: bb.url,
    username: LIMITED.name,
    password: LIMITED.password,
  });
}

async function provisionLimitedUser(
  bb: StartedBitbucket,
  projectKey: string,
  repoSlug: string,
): Promise<void> {
  const created = await bb.api.post("admin/users", {
    searchParams: {
      ...LIMITED,
      displayName: "Limited User",
      emailAddress: "limited@example.com",
    },
    throwHttpErrors: false,
  });
  // 409 = already provisioned by another test in this container.
  if (created.status !== 204 && created.status !== 409) {
    throw new Error(
      `user provisioning failed with ${created.status}: ${await created.text()}`,
    );
  }
  const granted = await bb.api.put(
    `projects/${projectKey}/repos/${repoSlug}/permissions/users`,
    {
      searchParams: { permission: "REPO_READ", name: LIMITED.name },
      throwHttpErrors: false,
    },
  );
  if (granted.status !== 204) {
    throw new Error(
      `permission grant failed with ${granted.status}: ${await granted.text()}`,
    );
  }
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
    const limited = limitedClient(bb);
    const pr = await scenario.project.repo.pr;
    await provisionLimitedUser(
      bb,
      scenario.project.key,
      scenario.project.repo.slug,
    );

    // Before the review is requested, the limited user has no relation to
    // the pr and their reviewer inbox must not list it. The first login of
    // a freshly provisioned user occasionally 401s on CI runners; retry
    // briefly before failing.
    type InboxPage = Awaited<
      ReturnType<BitbucketClient["inbox"]["listPullRequests"]>
    >;
    let before: InboxPage | undefined;
    for (let attempt = 0; attempt < 3; attempt++) {
      const page = await limited.inbox
        .listPullRequests({
          role: "REVIEWER",
          participantStatus: "UNAPPROVED",
          limit: 50,
        })
        .catch((error: unknown): InboxPage | Error => error as Error);
      if (!(page instanceof Error)) {
        before = page;
        break;
      }
      await new Promise((resolve) => setTimeout(resolve, 300));
    }
    expect(before).toBeDefined();
    expect(before?.values.map((pr) => pr.id)).not.toContain(pr.id);

    // Requesting the review adds them as a reviewer; the same filtered
    // inbox must now list it.
    await admin.pullRequests.update({
      project: scenario.project.key,
      repository: scenario.project.repo.slug,
      prId: pr.id,
      reviewers: [LIMITED.name],
    });
    const after = await limited.inbox.listPullRequests({
      role: "REVIEWER",
      participantStatus: "UNAPPROVED",
      limit: 50,
    });
    expect(after.values.map((pr) => pr.id)).toContain(pr.id);
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
