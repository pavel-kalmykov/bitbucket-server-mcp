import {
  GenericContainer,
  Wait,
  type StartedTestContainer,
} from "testcontainers";
import ky, { type KyInstance } from "ky";
import { mkdtemp, rm, writeFile, chmod } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import type { VersionConfig } from "./versions.js";

const ADMIN = { username: "admin", password: "admin" } as const;
const BITBUCKET_INTERNAL_PORT = 7990;
const SHARED_DIR_IN_CONTAINER =
  "/var/atlassian/application-data/bitbucket/shared";

export interface StartedBitbucket {
  /** Base URL (http://host:random-port) with path prefix stripped. */
  readonly url: string;
  /** Credentials that the helper provisions via unattended setup. */
  readonly admin: { readonly username: string; readonly password: string };
  /** Version name as declared in `VERSIONS` (e.g. `"8.9"`). */
  readonly version: string;
  /** ky instance with Basic auth + XSRF bypass pre-configured. */
  readonly api: KyInstance;
  /** Tears down the container. */
  stop(): Promise<void>;
}

/**
 * Render the `bitbucket.properties` content that drives the unattended
 * setup. The timebomb license is mandatory; we take it from env so the
 * value stays out of source. Passing the license via a property (not an
 * env var) is required because the container image does not map env
 * vars into the properties file automatically.
 */
function renderProperties(v: VersionConfig): string {
  const license = process.env.BITBUCKET_TIMEBOMB_LICENSE;
  if (!license) {
    throw new Error(
      "BITBUCKET_TIMEBOMB_LICENSE env var is required. Copy the 10-user Bitbucket Data Center timebomb license from https://developer.atlassian.com/platform/marketplace/timebomb-licenses-for-testing-server-apps/ and export it.",
    );
  }
  const props: Record<string, string> = {
    "setup.displayName": "E2E Test",
    "setup.baseUrl": `http://localhost:${BITBUCKET_INTERNAL_PORT}`,
    "setup.license": license,
    "setup.sysadmin.username": ADMIN.username,
    "setup.sysadmin.password": ADMIN.password,
    "setup.sysadmin.displayName": "Admin",
    "setup.sysadmin.emailAddress": "admin@example.com",
    ...v.extraProperties,
  };
  return (
    Object.entries(props)
      .map(([k, v]) => `${k}=${v}`)
      .join("\n") + "\n"
  );
}

/**
 * Bitbucket reports `"state":"RUNNING"` before REST auth is fully wired,
 * so we poll the authenticated endpoint as the real readiness signal.
 * The ky instance returned here is what the tests share.
 */
async function waitForAuthenticatedApi(
  baseUrl: string,
  timeoutMs: number,
): Promise<KyInstance> {
  const api = ky.create({
    prefix: `${baseUrl}/rest/api/1.0/`,
    headers: {
      Accept: "application/json",
      Authorization: `Basic ${Buffer.from(
        `${ADMIN.username}:${ADMIN.password}`,
      ).toString("base64")}`,
      // Bitbucket rejects mutations without the XSRF bypass header,
      // even for Basic-auth clients.
      "X-Atlassian-Token": "no-check",
    },
    retry: 0,
    timeout: 5_000,
  });

  const deadline = Date.now() + timeoutMs;
  let lastError: unknown;
  while (Date.now() < deadline) {
    try {
      const res = await api.get("projects").json<{ size: number }>();
      if (typeof res.size === "number") return api;
    } catch (err) {
      lastError = err;
    }
    await new Promise((r) => setTimeout(r, 2_000));
  }
  throw new Error(
    `Bitbucket did not reach authenticated-ready within ${timeoutMs}ms. Last error: ${String(lastError)}`,
  );
}

/**
 * Boot a Bitbucket Data Center container of the requested version with
 * the unattended setup wired up (DB -> license -> admin user). Returns a
 * ky client that tests share for the duration of the run.
 *
 * Boot time on Apple Silicon (ARM64) for native images is ~30-75s;
 * the amd64-only 7.21 image runs under Rosetta/QEMU and takes ~180-240s.
 */
export async function startBitbucket(
  version: VersionConfig,
): Promise<StartedBitbucket> {
  // Bind mount a host-owned directory rather than using
  // `withCopyContentToContainer`. The copy path creates parent
  // directories as root before the entrypoint runs, so the in-container
  // `bitbucket` user cannot later `mkdir shared/data` for H2 and the
  // unattended setup fails at the DB provisioning step.
  const hostSharedDir = await mkdtemp(join(tmpdir(), "bb-e2e-"));
  await writeFile(
    join(hostSharedDir, "bitbucket.properties"),
    renderProperties(version),
    { mode: 0o644 },
  );
  await chmod(hostSharedDir, 0o777);

  const container = await new GenericContainer(version.image)
    .withExposedPorts(BITBUCKET_INTERNAL_PORT)
    .withEnvironment(version.extraEnv ?? {})
    .withBindMounts([
      {
        source: hostSharedDir,
        target: SHARED_DIR_IN_CONTAINER,
        mode: "rw",
      },
    ])
    .withLogConsumer((stream) => {
      stream.on("data", (line) => {
        if (process.env.E2E_VERBOSE === "true") process.stderr.write(line);
      });
    })
    // `forListeningPorts` just waits for TCP accept; the authenticated
    // readiness gate is `waitForAuthenticatedApi` below, which confirms
    // the unattended setup finished and admin credentials work.
    .withWaitStrategy(Wait.forListeningPorts())
    .withStartupTimeout(420_000)
    .start();

  const host = container.getHost();
  const port = container.getMappedPort(BITBUCKET_INTERNAL_PORT);
  const url = `http://${host}:${port}`;

  const api = await waitForAuthenticatedApi(url, 240_000);

  return {
    url,
    admin: ADMIN,
    version: version.name,
    api,
    async stop() {
      // Bitbucket writes inside the bind mount as its internal
      // `bitbucket` user, so on Linux (GitHub Actions runners) the
      // host process cannot `rm -rf` the tmpdir afterwards. Chown
      // the whole tree back to the host's uid/gid first, running
      // as root inside the container so we can cross the ownership
      // boundary regardless of what the entrypoint user is.
      const uid = process.getuid?.() ?? 0;
      const gid = process.getgid?.() ?? 0;
      await container.exec(
        ["chown", "-R", `${uid}:${gid}`, SHARED_DIR_IN_CONTAINER],
        { user: "root" },
      );
      await container.stop();
      await rm(hostSharedDir, { recursive: true, force: true });
    },
  };
}

export { type StartedTestContainer };
