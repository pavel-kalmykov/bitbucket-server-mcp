import { expect } from "vitest";
import { atLeast } from ".././versions.js";
import { callAndParse } from "../../fixtures/tool-test-utils.js";
import { test, describeBitbucket } from ".././e2e-suite.js";

const SECRET_SCANNING_SINCE = "8.5";

describeBitbucket(
  "secret scanning manage",
  () => {
    test("manage_secret_scanning create, update, and delete round-trip", async ({
      mcp,
      scenario,
    }) => {
      const args = {
        project: scenario.project.key,
        repository: scenario.project.repo.slug,
      };
      const created = await callAndParse<{ id: number }>(
        mcp.client,
        "manage_secret_scanning",
        {
          ...args,
          action: "create",
          name: "e2e rule",
          lineRegex: "E2EPROBE-[a-z0-9]+",
        },
      );
      expect(typeof created.id).toBe("number");

      const updated = await callAndParse<{ pathRegex?: string }>(
        mcp.client,
        "manage_secret_scanning",
        {
          ...args,
          action: "update",
          ruleId: created.id,
          name: "e2e rule",
          pathRegex: ".*[.]pem",
        },
      );
      expect(updated.pathRegex).toBe(".*[.]pem");

      const removed = await callAndParse<{
        deleted: boolean;
        ruleId: number;
      }>(mcp.client, "manage_secret_scanning", {
        ...args,
        action: "delete",
        ruleId: created.id,
      });
      expect(removed.deleted).toBe(true);
      expect(removed.ruleId).toBe(created.id);
    });
  },
  atLeast(SECRET_SCANNING_SINCE),
);
