import { describe, test as base, inject } from "vitest";
import { activeVersion } from "./versions.js";
import {
  attachStartedBitbucket,
  type StartedBitbucket,
} from "./bitbucket-container.js";
import { setupMcpAgainst, type McpAgainstBitbucket } from "./mcp-harness.js";

export interface ScenarioBranch {
  /** Planned name: available without creating anything. */
  readonly name: string;
}

export interface ScenarioExistingBranch extends ScenarioBranch {
  /** Initial commit: already exists; the base is provisioned eagerly. */
  readonly firstCommit: { readonly id: string };
}

export interface ScenarioLazyBranch extends ScenarioBranch {
  /** Awaiting the id creates the branch and its initial commit. */
  readonly firstCommit: { readonly id: Promise<string> };
}

export interface ScenarioRepo {
  /** Planned name: available without creating anything. */
  readonly slug: string;
  readonly mainCommitId: string;
  readonly branches: {
    readonly main: ScenarioExistingBranch;
    readonly feature: ScenarioLazyBranch;
  };
  /** Awaiting it creates the feature branch and an open PR over main. */
  readonly pr: Promise<{ readonly id: number }>;
}

export interface ScenarioProject {
  /** Planned name: available without creating anything. */
  readonly key: string;
  readonly repo: ScenarioRepo;
}

/**
 * Collision ticket for project keys and repo slugs: Date.now() in base-36
 * yields a short alphanumeric suffix that differs across files and worker
 * recycles (no shared state), is valid in Bitbucket slugs, and stays
 * recognizable between the project and repo sharing it.
 */
function uniqueSuffix(): string {
  return Date.now().toString(36);
}

async function commitFile(
  bb: StartedBitbucket,
  projectKey: string,
  repoSlug: string,
  branch: string,
  path: string,
  content: string,
  message: string,
  sourceBranch?: string,
): Promise<string> {
  // Fixture setup talks to the raw Bitbucket REST contract, never to the
  // client this suite validates: a client bug must fail assertions, not
  // silently corrupt the fixture before any test runs (Four-Phase Test;
  // the arrange channel stays independent of the SUT).
  const form = new FormData();
  form.append("content", content);
  form.append("message", message);
  form.append("branch", branch);
  if (sourceBranch !== undefined) form.append("sourceBranch", sourceBranch);
  const result = await bb.api
    .put(`projects/${projectKey}/repos/${repoSlug}/browse/${path}`, {
      body: form,
    })
    .json<{ id: string }>();
  return result.id;
}

export interface Scenario {
  readonly project: ScenarioProject;
}

export interface BitbucketSuite {
  bb: StartedBitbucket;
  mcp: McpAgainstBitbucket;
  scenario: Scenario;
}

/**
 * The suite's resources as vitest fixtures. The container itself is
 * started once per project run by `global-setup.ts` and handed over
 * through `inject`; `bb` and `mcp` are worker-scoped fixtures that
 * attach to it (vitest re-runs worker fixtures per file, so they must
 * never start anything).
 *
 * `scenario` is file scoped and models the REST hierarchy. The base
 * (project + repo + main commit) is provisioned eagerly in the fixture
 * setup, so read-only tests can reference it by name without awaiting
 * anything; only `repo.pr` stays lazy (the feature branch, its commit
 * and the open PR are created on first await). Every file gets a
 * unique project + repo, so files never step on each other's refs and
 * no post-test cleanup is needed: the container dies with the global
 * setup teardown.
 *
 * Setting these up counts against `testTimeout`, not `hookTimeout`: vitest
 * charges fixture setup to whichever test triggers it, and there is no
 * per-fixture timeout. `vitest.config.e2e.ts` sizes `testTimeout` for a
 * container boot because of this.
 */
export const test = base.extend<BitbucketSuite>({
  bb: [
    // The empty pattern is required, not stylistic: vitest reads the
    // destructuring to learn which fixtures this one depends on, and rejects
    // a plain parameter with FixtureParseError. This fixture depends on none.
    // eslint-disable-next-line no-empty-pattern
    async ({}, use) => {
      const bb = await attachStartedBitbucket(
        inject("bbUrl"),
        inject("bbVersion"),
      );
      await use(bb);
      await bb.stop();
    },
    { scope: "worker" },
  ],
  mcp: [
    async ({ bb }, use) => {
      const mcp = await setupMcpAgainst(bb);
      await use(mcp);
      await mcp.close();
    },
    { scope: "worker" },
  ],
  scenario: [
    async ({ bb }, use) => {
      const suffix = uniqueSuffix();
      const projectKey = `E2E${suffix.toUpperCase()}`;
      const repoSlug = `repo-${suffix}`;

      await bb.api.post("projects", {
        json: { key: projectKey, name: projectKey },
      });
      await bb.api.post(`projects/${projectKey}/repos`, {
        json: { name: repoSlug },
      });
      const mainCommitId = await commitFile(
        bb,
        projectKey,
        repoSlug,
        "main",
        "README.md",
        "hello\n",
        "init",
      );

      let prNode: Promise<{ id: number }> | undefined;
      const repo: ScenarioRepo = {
        slug: repoSlug,
        mainCommitId,
        branches: {
          main: { name: "main", firstCommit: { id: mainCommitId } },
          feature: {
            name: "feature",
            firstCommit: {
              get id() {
                return commitFile(
                  bb,
                  projectKey,
                  repoSlug,
                  "feature",
                  "CHANGE.md",
                  "change\n",
                  "change",
                  "main",
                );
              },
            },
          },
        },
        get pr() {
          prNode ??= (async () => {
            // Opening the PR provisions its refs: main first, then the
            // feature branch cut from it.
            await repo.branches.main.firstCommit.id;
            await repo.branches.feature.firstCommit.id;
            const pr = await bb.api
              .post(`projects/${projectKey}/repos/${repoSlug}/pull-requests`, {
                json: {
                  title: "E2E PR",
                  fromRef: {
                    id: "refs/heads/feature",
                    repository: {
                      slug: repoSlug,
                      project: { key: projectKey },
                    },
                  },
                  toRef: {
                    id: "refs/heads/main",
                    repository: {
                      slug: repoSlug,
                      project: { key: projectKey },
                    },
                  },
                },
              })
              .json<{ id: number }>();
            return { id: pr.id };
          })();
          return prNode;
        },
      };
      await use({ project: { key: projectKey, repo } });
    },
    { scope: "file" },
  ],
});

/**
 * Names the suite after the version under test, so a CI log line says which
 * Bitbucket produced it. `enabled` is how a suite opts out on versions that
 * lack the feature it covers, in place of the version-partitioned lists the
 * matrix used to need.
 */
export function describeBitbucket(
  name: string,
  fn: () => void,
  enabled = true,
): void {
  describe.skipIf(!enabled)(`${name}: Bitbucket ${activeVersion().name}`, fn);
}
