import { describe, test, expect } from "vitest";
import { registerInsightTools } from "../../tools/insights.js";
import { mockError, mockJson } from "../test-utils.js";
import { callAndParse, callRaw, setupToolHarness } from "../tool-test-utils.js";

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

      mockJson(h.mockClients.insights.get, mockReports);
      mockJson(h.mockClients.insights.get, sonarAnnotations);
      mockJson(h.mockClients.insights.get, coverageAnnotations);

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

      mockJson(h.mockClients.insights.get, mockReports);
      mockError(
        h.mockClients.insights.get,
        new Error("Annotations not available"),
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

      const result = await callRaw(h.client, "get_code_insights", { project: "TEST", repository: "my-repo", prId: 1 });

      expect(result.isError).toBe(true);
    });

    test("should query annotations for each report by key", async () => {
      mockJson(h.mockClients.insights.get, {
        values: [
          { key: "sonar", title: "Sonar", result: "PASS" },
          { key: "coverage", title: "Coverage", result: "FAIL" },
        ],
      });
      mockJson(h.mockClients.insights.get, { values: [] });
      mockJson(h.mockClients.insights.get, { values: [] });

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

      mockJson(h.mockClients.insights.get, reportsList);
      mockJson(h.mockClients.insights.get, { values: [{ message: "Bug" }] });

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
      mockJson(h.mockClients.insights.get, {
        values: [{ key: "sonar", title: "SonarQube", result: "PASS" }],
      });
      mockJson(h.mockClients.insights.get, { values: [] });
      mockJson(h.mockClients.insights.get, {
        annotations: [
          {
            line: 42,
            message: "Cognitive Complexity",
            severity: "HIGH",
            type: "CODE_SMELL",
          },
        ],
      });
      mockJson(h.mockClients.insights.get, {
        annotations: [
          {
            line: 10,
            message: "Unused import",
            severity: "LOW",
            type: "CODE_SMELL",
          },
        ],
      });

      mockJson(h.mockClients.api.get, {
        values: [
          { path: { toString: "src/foo.ts" } },
          { path: { toString: "src/bar.ts" } },
        ],
        isLastPage: true,
      });

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

      const fileAnnotationCalls = h.mockClients.insights.get.mock.calls.filter(
        (c) =>
          String(c[0]).endsWith("/annotations") &&
          !String(c[0]).includes("/reports/"),
      );
      expect(fileAnnotationCalls).toHaveLength(2);
      expect(fileAnnotationCalls[0][0]).toBe(
        "projects/TEST/repos/my-repo/pull-requests/1/annotations",
      );
      expect(fileAnnotationCalls[0][1]).toEqual(
        expect.objectContaining({
          searchParams: { path: "src/foo.ts", annotationLocation: "FILES" },
        }),
      );
      expect(fileAnnotationCalls[1][0]).toBe(
        "projects/TEST/repos/my-repo/pull-requests/1/annotations",
      );
      expect(fileAnnotationCalls[1][1]).toEqual(
        expect.objectContaining({
          searchParams: { path: "src/bar.ts", annotationLocation: "FILES" },
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

      mockJson(h.mockClients.api.get, {
        values: [
          { path: { toString: "src/ok.ts" } },
          { path: { toString: "src/broken.ts" } },
        ],
        isLastPage: true,
      });

      mockJson(h.mockClients.insights.get, {
        annotations: [
          {
            line: 1,
            message: "Fine",
            severity: "LOW",
            type: "CODE_SMELL",
          },
        ],
      });
      mockError(
        h.mockClients.insights.get,
        new Error("Annotations unavailable"),
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

      mockJson(h.mockClients.api.get, { values: [], isLastPage: true });

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

    test("defaults fileAnnotationsIsLastPage to true when isLastPage absent", async () => {
      mockJson(h.mockClients.insights.get, {
        values: [{ key: "sonar", title: "SonarQube", result: "PASS" }],
      });
      mockJson(h.mockClients.insights.get, { values: [] });

      mockJson(h.mockClients.api.get, {
        values: [{ path: { toString: "src/a.ts" } }],
      });

      mockJson(h.mockClients.insights.get, { annotations: [] });

      const parsed = await callAndParse<{
        fileAnnotationsIsLastPage: boolean;
        fileAnnotationsNextPageStart?: number;
      }>(h.client, "get_code_insights", {
        project: "TEST",
        repository: "my-repo",
        prId: 1,
        includeFileAnnotations: true,
      });

      expect(parsed.fileAnnotationsIsLastPage).toBe(true);
      expect(parsed).not.toHaveProperty("fileAnnotationsNextPageStart");
    });

    test("forwards fileStart and fileLimit as start and limit searchParams", async () => {
      mockJson(h.mockClients.insights.get, {
        values: [{ key: "sonar", title: "SonarQube", result: "PASS" }],
      });
      mockJson(h.mockClients.insights.get, { values: [] });

      mockJson(h.mockClients.api.get, {
        values: [{ path: { toString: "src/f1.ts" } }],
        isLastPage: true,
      });

      mockJson(h.mockClients.insights.get, { annotations: [] });

      await callAndParse(h.client, "get_code_insights", {
        project: "TEST",
        repository: "my-repo",
        prId: 1,
        includeFileAnnotations: true,
        fileStart: 10,
        fileLimit: 5,
      });

      const apiCalls = h.mockClients.api.get.mock.calls;
      expect(apiCalls[0][1]).toEqual(
        expect.objectContaining({
          searchParams: expect.objectContaining({ start: 10, limit: 5 }),
        }),
      );
    });

    test("should propagate isLastPage and nextPageStart from changes endpoint", async () => {
      // given: first page of 5 out of 15 files
      mockJson(h.mockClients.insights.get, {
        values: [{ key: "sonar", title: "SonarQube", result: "PASS" }],
      });
      mockJson(h.mockClients.insights.get, { values: [] });

      mockJson(h.mockClients.api.get, {
        values: [
          { path: { toString: "src/f1.ts" } },
          { path: { toString: "src/f2.ts" } },
          { path: { toString: "src/f3.ts" } },
          { path: { toString: "src/f4.ts" } },
          { path: { toString: "src/f5.ts" } },
        ],
        isLastPage: false,
        nextPageStart: 15,
      });

      for (let i = 0; i < 5; i++) {
        mockJson(h.mockClients.insights.get, { annotations: [] });
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
      const result = await callRaw(h.client, "get_build_status", {});

      expect(result.isError).toBe(true);
      const text = result.content[0].text;
      expect(text).toContain("commitId or prId");
    });

    test("should return error when prId provided but no repository", async () => {
      const result = await callRaw(h.client, "get_build_status", { prId: 42 });

      expect(result.isError).toBe(true);
      const text = result.content[0].text;
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

    test("prId takes precedence over commitId when both provided", async () => {
      mockJson(h.mockClients.api.get, {
        fromRef: { latestCommit: "resolved999" },
      });

      mockJson(h.mockClients.buildStatus.get, {
        values: [{ state: "SUCCESSFUL" }],
      });

      await callAndParse<Array<{ state: string }>>(
        h.client,
        "get_build_status",
        {
          project: "P",
          repository: "R",
          prId: 1,
          commitId: "should-be-ignored",
        },
      );

      expect(h.mockClients.api.get).toHaveBeenCalledWith(
        "projects/P/repos/R/pull-requests/1",
      );
      expect(h.mockClients.buildStatus.get).toHaveBeenCalledWith(
        "commits/resolved999",
      );
      expect(h.mockClients.buildStatus.get).not.toHaveBeenCalledWith(
        "commits/should-be-ignored",
      );
    });
  });
});
