import { expect } from "vitest";
import { createBitbucketClient } from "../../api/client.js";
import { test, describeBitbucket } from "./e2e-suite.js";

describeBitbucket("inbox", () => {
  test("lists the scenario pull request authored by the admin", async ({
    bb,
    scenario,
  }) => {
    // The scenario fixture opens a PR authored by the admin user; the inbox
    // of that same user must list it under the AUTHOR role.
    const client = createBitbucketClient({
      baseUrl: bb.url,
      username: bb.admin.username,
      password: bb.admin.password,
    });
    // Awaiting the pr first: the lazy fixture provisions it on demand.
    const prId = (await scenario.project.repo.pr).id;

    const page = await client.inbox.listPullRequests({
      role: "AUTHOR",
      limit: 50,
    });
    const ids = page.values.map((pr) => pr.id);
    expect(ids).toContain(prId);
  });

  test("reports the inbox count", async ({ bb }) => {
    const client = createBitbucketClient({
      baseUrl: bb.url,
      username: bb.admin.username,
      password: bb.admin.password,
    });

    const count = await client.inbox.count();

    expect(count.count).toBeGreaterThanOrEqual(0);
  });
});
