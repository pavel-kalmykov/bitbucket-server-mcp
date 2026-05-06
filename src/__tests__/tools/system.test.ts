import { describe, test, expect } from "vitest";
import { registerSystemTools } from "../../tools/system.js";
import { mockError, mockJson } from "../test-utils.js";
import { callAndParse, callRaw, setupToolHarness } from "../tool-test-utils.js";

describe("System tools", () => {
  const h = setupToolHarness({
    register: registerSystemTools,
    defaultProject: "DEFAULT",
  });

  describe("get_server_info", () => {
    test("should return server properties", async () => {
      mockJson(h.mockClients.api.get, {
        version: "8.19.1",
        buildNumber: "8190100",
        displayName: "Bitbucket",
      });

      const parsed = await callAndParse<{
        version: string;
        displayName: string;
      }>(h.client, "get_server_info", {});
      expect(parsed.version).toBe("8.19.1");
      expect(parsed.displayName).toBe("Bitbucket");

      expect(h.mockClients.api.get).toHaveBeenCalledWith(
        "application-properties",
      );
    });

    test("should handle errors gracefully", async () => {
      mockError(h.mockClients.api.get, new Error("Connection refused"));

      const result = await callRaw(h.client, "get_server_info", {});

      expect(result.isError).toBe(true);
    });
  });
});
