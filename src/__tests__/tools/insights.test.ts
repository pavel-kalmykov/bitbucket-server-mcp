import { describe, test, expect } from "vitest";
import { registerInsightTools } from "../../tools/insights.js";
import { fakeResponse, mockError, mockJson } from "../test-utils.js";
import { callAndParse, setupToolHarness } from "../tool-test-utils.js";

describe("Insight tools", () => {
  const h = setupToolHarness({
    register: registerInsightTools,
    defaultProject: "DEFAULT",
  });

  describe("get_code_insights", () => {
    test("should fetch reports and annotations", async () => {
      const mockReports = {
        values: [
          { key: "sonar", title: "SonarQube", result: "PASS" },
          { key: "coverage", title: "Coverage", result: "FAIL" },
        ],
      };

      const sonarAnnotations = {
        values: [
          {
            path: "src/index.ts",
            line: 10,
            message: "Bug found",
            severity: "HIGH",
          },
        ],
      };

      const coverageAnnotations = {
        values: [
          {
            path: "src/utils.ts",
            line: 5,
            message: "Not covered",
            severity: "LOW",
          },
        ],
      };

      h.mockClients.insights.get
        .mockReturnValueOnce(
          fakeResponse({ json: () => Promise.resolve(mockReports) }),
        )
        .mockReturnValueOnce(
          fakeResponse({ json: () => Promise.resolve(sonarAnnotations) }),
        )
        .mockReturnValueOnce(
          fakeResponse({ json: () => Promise.resolve(coverageAnnotations) }),
        );

      const parsed = await callAndParse<{
        reports: Array<{ key: string }>;
        annotations: Record<string, Array<{ message: string }>>;
      }>(h.client, "get_code_insights", {
        project: "TEST",
        repository: "my-repo",
        prId: 1,
      });

      expect(parsed.reports).toHaveLength(2);
      expect(parsed.reports[0].key).toBe("sonar");
      expect(parsed.reports[1].key).toBe("coverage");

      expect(parsed.annotations["sonar"]).toHaveLength(1);
      expect(parsed.annotations["sonar"][0].message).toBe("Bug found");

      expect(parsed.annotations["coverage"]).toHaveLength(1);
      expect(parsed.annotations["coverage"][0].message).toBe("Not covered");
    });

    test("should use default project when not provided", async () => {
      mockJson(h.mockClients.insights.get, { values: [] });

      await h.client.callTool({
        name: "get_code_insights",
        arguments: { repository: "my-repo", prId: 1 },
      });

      expect(h.mockClients.insights.get).toHaveBeenCalledWith(
        "projects/DEFAULT/repos/my-repo/pull-requests/1/reports",
      );
    });

    test("should default annotations to empty array on error", async () => {
      const mockReports = {
        values: [{ key: "broken-report", title: "Broken", result: "PASS" }],
      };

      h.mockClients.insights.get
        .mockReturnValueOnce(
          fakeResponse({ json: () => Promise.resolve(mockReports) }),
        )
        .mockReturnValueOnce(
          fakeResponse({
            json: () => Promise.reject(new Error("Annotations not available")),
          }),
        );

      const parsed = await callAndParse<{
        reports: Array<{ key: string }>;
        annotations: Record<string, unknown[]>;
      }>(h.client, "get_code_insights", {
        project: "TEST",
        repository: "my-repo",
        prId: 1,
      });

      expect(parsed.reports).toHaveLength(1);
      expect(parsed.annotations["broken-report"]).toEqual([]);
    });

    test("should handle reports fetch error", async () => {
      mockError(h.mockClients.insights.get, new Error("Server error"));

      const result = await h.client.callTool({
        name: "get_code_insights",
        arguments: { project: "TEST", repository: "my-repo", prId: 1 },
      });

      expect(result.isError).toBe(true);
    });

    test("should use default project when not provided", async () => {
      mockJson(h.mockClients.insights.get, { values: [] });

      await h.client.callTool({
        name: "get_code_insights",
        arguments: { repository: "my-repo", prId: 1 },
      });

      expect(h.mockClients.insights.get).toHaveBeenCalledWith(
        "projects/DEFAULT/repos/my-repo/pull-requests/1/reports",
      );
    });

    test("should query annotations for each report by key", async () => {
      h.mockClients.insights.get
        .mockReturnValueOnce(
          fakeResponse({
            json: () =>
              Promise.resolve({
                values: [
                  { key: "sonar", title: "Sonar", result: "PASS" },
                  { key: "coverage", title: "Coverage", result: "FAIL" },
                ],
              }),
          }),
        )
        .mockReturnValueOnce(
          fakeResponse({ json: () => Promise.resolve({ values: [] }) }),
        )
        .mockReturnValueOnce(
          fakeResponse({ json: () => Promise.resolve({ values: [] }) }),
        );

      await callAndParse(h.client, "get_code_insights", {
        project: "TEST",
        repository: "my-repo",
        prId: 1,
      });

      const urls = h.mockClients.insights.get.mock.calls.map((c) =>
        String(c[0]),
      );
      expect(urls).toEqual(
        expect.arrayContaining([
          expect.stringContaining("/reports/sonar/annotations"),
          expect.stringContaining("/reports/coverage/annotations"),
        ]),
      );
    });

    test("should skip reports without a key", async () => {
      const reportsList = {
        values: [
          { key: "sonar", title: "SonarQube", result: "PASS" },
          { title: "No Key Report", result: "PASS" },
        ],
      };

      h.mockClients.insights.get
        .mockReturnValueOnce(
          fakeResponse({ json: () => Promise.resolve(reportsList) }),
        )
        .mockReturnValueOnce(
          fakeResponse({
            json: () => Promise.resolve({ values: [{ message: "Bug" }] }),
          }),
        );

      const parsed = await callAndParse<{
        reports: unknown[];
        annotations: Record<string, unknown[]>;
      }>(h.client, "get_code_insights", {
        project: "TEST",
        repository: "my-repo",
        prId: 1,
      });

      expect(parsed.reports).toHaveLength(2);
      expect(parsed.annotations["sonar"]).toHaveLength(1);
      expect(parsed.annotations).not.toHaveProperty("undefined");
    });

    test("should handle empty reports list", async () => {
      mockJson(h.mockClients.insights.get, { values: [] });

      const parsed = await callAndParse<{
        reports: unknown[];
        annotations: Record<string, unknown>;
      }>(h.client, "get_code_insights", {
        project: "TEST",
        repository: "my-repo",
        prId: 1,
      });

      expect(parsed.reports).toHaveLength(0);
      expect(parsed.annotations).toEqual({});
    });

    test("should return file annotations keyed by path when includeFileAnnotations is true", async () => {
      // given: two reports + two changed files, both have annotations
      h.mockClients.insights.get
        .mockReturnValueOnce(
          fakeResponse({
            json: () =>
              Promise.resolve({
                values: [{ key: "sonar", title: "SonarQube", result: "PASS" }],
              }),
          }),
        )
        .mockReturnValueOnce(
          fakeResponse({ json: () => Promise.resolve({ values: [] }) }),
        )
        .mockReturnValueOnce(
          fakeResponse({
            json: () =>
              Promise.resolve({
                annotations: [
                  {
                    line: 42,
                    message: "Cognitive Complexity",
                    severity: "HIGH",
                    type: "CODE_SMELL",
                  },
                ],
              }),
          }),
        )
        .mockReturnValueOnce(
          fakeResponse({
            json: () =>
              Promise.resolve({
                annotations: [
                  {
                    line: 10,
                    message: "Unused import",
                    severity: "LOW",
                    type: "CODE_SMELL",
                  },
                ],
              }),
          }),
        );

      h.mockClients.api.get.mockReturnValueOnce(
        fakeResponse({
          json: () =>
            Promise.resolve({
              values: [
                { path: { toString: "src/foo.ts" } },
                { path: { toString: "src/bar.ts" } },
              ],
              isLastPage: true,
            }),
        }),
      );

      // when
      const parsed = await callAndParse<{
        reports: unknown[];
        annotations: Record<string, unknown[]>;
        fileAnnotations: Record<string, unknown[]>;
        fileAnnotationsIsLastPage: boolean;
      }>(h.client, "get_code_insights", {
        project: "TEST",
        repository: "my-repo",
        prId: 1,
        includeFileAnnotations: true,
      });

      // then
      expect(parsed.reports).toHaveLength(1);
      expect(parsed.fileAnnotations).toEqual({
        "src/foo.ts": [
          {
            line: 42,
            message: "Cognitive Complexity",
            severity: "HIGH",
            type: "CODE_SMELL",
          },
        ],
        "src/bar.ts": [
          {
            line: 10,
            message: "Unused import",
            severity: "LOW",
            type: "CODE_SMELL",
          },
        ],
      });
      expect(parsed.fileAnnotationsIsLastPage).toBe(true);
      expect(parsed).not.toHaveProperty("fileAnnotationsNextPageStart");

      const apiCalls = h.mockClients.api.get.mock.calls;
      expect(apiCalls[0][0]).toContain("/changes");
      expect(apiCalls[0][1]).toEqual(
        expect.objectContaining({
          searchParams: expect.objectContaining({ start: 0, limit: 50 }),
        }),
      );
    });

    test("should not include fileAnnotations when flag is omitted", async () => {
      // given: only reports (no /changes mock)
      mockJson(h.mockClients.insights.get, { values: [] });

      // when
      const parsed = await callAndParse<{
        reports: unknown[];
        annotations: Record<string, unknown>;
        fileAnnotations?: unknown;
      }>(h.client, "get_code_insights", {
        project: "TEST",
        repository: "my-repo",
        prId: 1,
      });

      // then
      expect(parsed.reports).toHaveLength(0);
      expect(parsed.annotations).toEqual({});
      expect(parsed).not.toHaveProperty("fileAnnotations");
      expect(h.mockClients.api.get).not.toHaveBeenCalled();
    });

    test("should not include fileAnnotations when changes endpoint fails", async () => {
      // given: reports succeed, /changes fails
      mockJson(h.mockClients.insights.get, {
        values: [{ key: "sonar", title: "SonarQube", result: "PASS" }],
      });
      mockJson(h.mockClients.insights.get, { values: [] });
      mockError(h.mockClients.api.get, new Error("Changes not available"));

      // when
      const parsed = await callAndParse<{
        reports: unknown[];
        annotations: Record<string, unknown>;
        fileAnnotations?: unknown;
      }>(h.client, "get_code_insights", {
        project: "TEST",
        repository: "my-repo",
        prId: 1,
        includeFileAnnotations: true,
      });

      // then
      expect(parsed.reports).toHaveLength(1);
      expect(parsed).not.toHaveProperty("fileAnnotations");
    });

    test("should return empty array for a file whose annotations fetch fails", async () => {
      // given: two changed files, second /annotations call fails
      mockJson(h.mockClients.insights.get, {
        values: [{ key: "sonar", title: "SonarQube", result: "PASS" }],
      });
      mockJson(h.mockClients.insights.get, { values: [] });

      h.mockClients.api.get.mockReturnValueOnce(
        fakeResponse({
          json: () =>
            Promise.resolve({
              values: [
                { path: { toString: "src/ok.ts" } },
                { path: { toString: "src/broken.ts" } },
              ],
              isLastPage: true,
            }),
        }),
      );

      // first file → OK
      h.mockClients.insights.get.mockReturnValueOnce(
        fakeResponse({
          json: () =>
            Promise.resolve({
              annotations: [
                {
                  line: 1,
                  message: "Fine",
                  severity: "LOW",
                  type: "CODE_SMELL",
                },
              ],
            }),
        }),
      );
      // second file → fails
      h.mockClients.insights.get.mockReturnValueOnce(
        fakeResponse({
          json: () => Promise.reject(new Error("Annotations unavailable")),
        }),
      );

      // when
      const parsed = await callAndParse<{
        fileAnnotations: Record<string, unknown[]>;
      }>(h.client, "get_code_insights", {
        project: "TEST",
        repository: "my-repo",
        prId: 1,
        includeFileAnnotations: true,
      });

      // then
      expect(parsed.fileAnnotations["src/ok.ts"]).toHaveLength(1);
      expect(parsed.fileAnnotations["src/broken.ts"]).toEqual([]);
    });

    test("should return empty fileAnnotations when there are no changed files", async () => {
      // given: no changed files
      mockJson(h.mockClients.insights.get, {
        values: [{ key: "sonar", title: "SonarQube", result: "PASS" }],
      });
      mockJson(h.mockClients.insights.get, { values: [] });

      h.mockClients.api.get.mockReturnValueOnce(
        fakeResponse({
          json: () => Promise.resolve({ values: [], isLastPage: true }),
        }),
      );

      // when
      const parsed = await callAndParse<{
        fileAnnotations: Record<string, unknown[]>;
        fileAnnotationsIsLastPage: boolean;
      }>(h.client, "get_code_insights", {
        project: "TEST",
        repository: "my-repo",
        prId: 1,
        includeFileAnnotations: true,
      });

      // then
      expect(parsed.fileAnnotations).toEqual({});
      expect(parsed.fileAnnotationsIsLastPage).toBe(true);
    });

    test("should propagate isLastPage and nextPageStart from changes endpoint", async () => {
      // given: first page of 5 out of 15 files
      mockJson(h.mockClients.insights.get, {
        values: [{ key: "sonar", title: "SonarQube", result: "PASS" }],
      });
      mockJson(h.mockClients.insights.get, { values: [] });

      h.mockClients.api.get.mockReturnValueOnce(
        fakeResponse({
          json: () =>
            Promise.resolve({
              values: [
                { path: { toString: "src/f1.ts" } },
                { path: { toString: "src/f2.ts" } },
                { path: { toString: "src/f3.ts" } },
                { path: { toString: "src/f4.ts" } },
                { path: { toString: "src/f5.ts" } },
              ],
              isLastPage: false,
              nextPageStart: 15,
            }),
        }),
      );

      // each file returns empty annotations
      for (let i = 0; i < 5; i++) {
        h.mockClients.insights.get.mockReturnValueOnce(
          fakeResponse({ json: () => Promise.resolve({ annotations: [] }) }),
        );
      }

      // when
      const parsed = await callAndParse<{
        fileAnnotations: Record<string, unknown[]>;
        fileAnnotationsIsLastPage: boolean;
        fileAnnotationsNextPageStart?: number;
      }>(h.client, "get_code_insights", {
        project: "TEST",
        repository: "my-repo",
        prId: 1,
        includeFileAnnotations: true,
        fileStart: 10,
        fileLimit: 5,
      });

      // then
      expect(Object.keys(parsed.fileAnnotations)).toHaveLength(5);
      expect(parsed.fileAnnotationsIsLastPage).toBe(false);
      expect(parsed.fileAnnotationsNextPageStart).toBe(15);

      const apiCalls = h.mockClients.api.get.mock.calls;
      expect(apiCalls[0][1]).toEqual(
        expect.objectContaining({
          searchParams: expect.objectContaining({ start: 10, limit: 5 }),
        }),
      );
    });
  });

  describe("get_build_status", () => {
    test("should fetch build status by commit ID", async () => {
      mockJson(h.mockClients.buildStatus.get, {
        values: [
          {
            state: "SUCCESSFUL",
            key: "jenkins-123",
            name: "Build #123",
            url: "https://jenkins.example.com/job/123",
          },
        ],
      });

      const parsed = await callAndParse<Array<{ state: string; url: string }>>(
        h.client,
        "get_build_status",
        { commitId: "abc123def456" },
      );

      expect(parsed).toHaveLength(1);
      expect(parsed[0].state).toBe("SUCCESSFUL");
      expect(parsed[0].url).toBe("https://jenkins.example.com/job/123");
      expect(h.mockClients.buildStatus.get).toHaveBeenCalledWith(
        "commits/abc123def456",
      );
    });

    test("should resolve latest commit from PR and fetch build status", async () => {
      mockJson(h.mockClients.api.get, {
        fromRef: { latestCommit: "resolved999" },
      });

      mockJson(h.mockClients.buildStatus.get, {
        values: [
          {
            state: "FAILED",
            name: "Build #99",
            url: "https://ci.example.com/99",
          },
        ],
      });

      const parsed = await callAndParse<Array<{ state: string }>>(
        h.client,
        "get_build_status",
        { project: "PROJ", repository: "my-repo", prId: 42 },
      );

      expect(parsed[0].state).toBe("FAILED");
      expect(h.mockClients.api.get).toHaveBeenCalledWith(
        "projects/PROJ/repos/my-repo/pull-requests/42",
      );
      expect(h.mockClients.buildStatus.get).toHaveBeenCalledWith(
        "commits/resolved999",
      );
    });

    test("should return error when neither commitId nor prId provided", async () => {
      const result = await h.client.callTool({
        name: "get_build_status",
        arguments: {},
      });

      expect(result.isError).toBe(true);
      const text = (result.content as Array<{ text: string }>)[0].text;
      expect(text).toContain("commitId or prId");
    });

    test("should return error when prId provided but no repository", async () => {
      const result = await h.client.callTool({
        name: "get_build_status",
        arguments: { prId: 42 },
      });

      expect(result.isError).toBe(true);
      const text = (result.content as Array<{ text: string }>)[0].text;
      expect(text).toContain("repository is required");
    });

    test("should return empty array when commit has no build statuses", async () => {
      mockJson(h.mockClients.buildStatus.get, { values: [] });

      const parsed = await callAndParse<unknown[]>(
        h.client,
        "get_build_status",
        { commitId: "abc123" },
      );
      expect(parsed).toEqual([]);
    });

    test.each(["SUCCESSFUL", "FAILED", "INPROGRESS"])(
      "returns build status %s correctly",
      async (state) => {
        mockJson(h.mockClients.buildStatus.get, {
          values: [{ state, name: "build", url: "https://ci.example.com" }],
        });

        const parsed = await callAndParse<Array<{ state: string }>>(
          h.client,
          "get_build_status",
          { commitId: "abc" },
        );
        expect(parsed[0].state).toBe(state);
      },
    );
  });
});
