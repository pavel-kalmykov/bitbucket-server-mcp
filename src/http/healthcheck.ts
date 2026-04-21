import { HTTPError } from "ky";
import type { ApiClients } from "./client.js";
import { logger } from "../logging.js";
import { extractBitbucketMessage } from "./errors.js";

/**
 * Run a best-effort connectivity check against Bitbucket Server's public
 * `application-properties` endpoint. Opt-in because it adds ~100ms to
 * startup and most clients won't care.
 *
 * Never throws. The server still comes up if the healthcheck fails; the
 * goal is only to surface a clearer diagnostic than the first tool call
 * would otherwise print.
 */
export async function runStartupHealthcheck(
  clients: ApiClients,
): Promise<void> {
  try {
    await clients.api.get("application-properties").json();
    logger.info("Startup healthcheck: reachable.");
  } catch (error) {
    if (error instanceof HTTPError) {
      const status = error.response.status;
      const serverMsg = extractBitbucketMessage(error.data) || error.message;
      if (status === 401) {
        logger.warn(
          `Startup healthcheck: HTTP 401. Verify BITBUCKET_TOKEN or BITBUCKET_USERNAME/BITBUCKET_PASSWORD, or BITBUCKET_CUSTOM_HEADERS if your environment needs extra auth headers. Server: ${serverMsg}`,
        );
      } else if (status === 403) {
        logger.warn(
          `Startup healthcheck: HTTP 403. Your credentials authenticate but have no access to the probed endpoint. Server: ${serverMsg}`,
        );
      } else {
        logger.warn(
          `Startup healthcheck: HTTP ${status}. Server: ${serverMsg}`,
        );
      }
      return;
    }
    const message = error instanceof Error ? error.message : String(error);
    logger.warn(
      `Startup healthcheck: could not reach Bitbucket: ${message}. Relevant env vars: BITBUCKET_URL, HTTPS_PROXY, NODE_EXTRA_CA_CERTS.`,
    );
  }
}
