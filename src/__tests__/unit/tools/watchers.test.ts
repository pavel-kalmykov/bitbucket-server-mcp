import { describe, expect, test } from "vitest";
import { BitbucketApiError } from "../../../api/http/errors.js";
import { registerWatcherTools } from "../../../tools/watchers.js";
import { mockReject } from "../../fixtures/test-utils.js";
import {
  callAndParse,
  callRaw,
  setupToolHarness,
} from "../../fixtures/tool-test-utils.js";

describe("watch_repository", () => {
  const h = setupToolHarness({
    register: registerWatcherTools,
    defaultProject: "DEFAULT",
  });

  test("answers watching true on the empty 204 response", async () => {
    const parsed = await callAndParse<{ watching: boolean }>(
      h.client,
      "watch_repository",
      { project: "TEST", repository: "my-repo" },
    );

    expect(parsed).toEqual({ watching: true });
    expect(h.mockClients.api.post).toHaveBeenCalledWith(
      "projects/TEST/repos/my-repo/watch",
    );
  });

  test("resolves the project from the default when omitted", async () => {
    await callAndParse(h.client, "watch_repository", {
      repository: "my-repo",
    });

    expect(h.mockClients.api.post).toHaveBeenCalledWith(
      "projects/DEFAULT/repos/my-repo/watch",
    );
  });

  test("reports the error when the repository does not exist", async () => {
    mockReject(
      h.mockClients.api.post,
      new BitbucketApiError({
        message: "Repository TEST/my-repo does not exist.",
        status: 404,
        url: "https://bitbucket.test/projects/TEST/repos/my-repo/watch",
        body: {
          errors: [
            {
              exceptionName:
                "com.atlassian.bitbucket.repository.NoSuchRepositoryException",
              message: "Repository TEST/my-repo does not exist.",
            },
          ],
        },
      }),
    );

    const result = await callRaw(h.client, "watch_repository", {
      project: "TEST",
      repository: "my-repo",
    });

    expect(result.isError).toBe(true);
    expect(result.content[0].text).toContain("does not exist");
  });
});

describe("unwatch_repository", () => {
  const h = setupToolHarness({
    register: registerWatcherTools,
    defaultProject: "DEFAULT",
  });

  test("answers watching false on the empty 204 response", async () => {
    const parsed = await callAndParse<{ watching: boolean }>(
      h.client,
      "unwatch_repository",
      { project: "TEST", repository: "my-repo" },
    );

    expect(parsed).toEqual({ watching: false });
    expect(h.mockClients.api.delete).toHaveBeenCalledWith(
      "projects/TEST/repos/my-repo/watch",
    );
  });

  test("reports the error when the repository does not exist", async () => {
    mockReject(
      h.mockClients.api.delete,
      new BitbucketApiError({
        message: "Repository TEST/my-repo does not exist.",
        status: 404,
        url: "https://bitbucket.test/projects/TEST/repos/my-repo/watch",
        body: {
          errors: [
            {
              exceptionName:
                "com.atlassian.bitbucket.repository.NoSuchRepositoryException",
              message: "Repository TEST/my-repo does not exist.",
            },
          ],
        },
      }),
    );

    const result = await callRaw(h.client, "unwatch_repository", {
      project: "TEST",
      repository: "my-repo",
    });

    expect(result.isError).toBe(true);
    expect(result.content[0].text).toContain("does not exist");
  });
});
