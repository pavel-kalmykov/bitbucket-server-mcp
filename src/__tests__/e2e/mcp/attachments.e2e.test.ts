import http from "node:http";
import { mkdtemp, readFile, rm, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { randomUUID, randomBytes } from "node:crypto";
import { callAndParse, callRaw } from "../../fixtures/tool-test-utils.js";
import type { Attachment } from "../../../api/repositories.js";
import { setupMcpAgainst } from "../mcp-harness.js";
import { test, describeBitbucket } from "../e2e-suite.js";

// Canonical 1x1 transparent PNG (valid CRCs); a real binary exercises
// byte-exact round-trips.
const PNG_BYTES = Buffer.from(
  "iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mNkYPhfDwAChwGA60e6kgAAAABJRU5ErkJggg==",
  "base64",
);

function limitedUser(): { name: string; password: string } {
  return {
    name: `limited-${randomUUID().slice(0, 8)}`,
    password: "limited-password",
  };
}

describeBitbucket("attachments", () => {
  test("upload, download, and delete round-trip with exact bytes", async ({
    mcp,
    scenario,
  }) => {
    const dir = await mkdtemp(join(tmpdir(), "e2e-attach-"));
    try {
      const imagePath = join(dir, "dot.png");
      await writeFile(imagePath, PNG_BYTES);

      const uploaded = await callAndParse<Attachment>(
        mcp.client,
        "upload_attachment",
        {
          project: scenario.project.key,
          repository: scenario.project.repo.slug,
          filePath: imagePath,
        },
      );

      expect(uploaded.id).toMatch(/^\d+$/);
      expect(uploaded.links.attachment.href).toMatch(/^attachment:\d+\/\d+$/);

      const download = await callAndParse<{
        attachmentId: string;
        contentType: string;
        size: number;
        savedTo: string;
      }>(mcp.client, "download_attachment", {
        project: scenario.project.key,
        repository: scenario.project.repo.slug,
        attachmentId: uploaded.id,
        filePath: join(dir, "downloaded.png"),
      });
      expect(download.size).toBe(PNG_BYTES.byteLength);
      expect(await readFile(download.savedTo)).toEqual(PNG_BYTES);

      const deleted = await callAndParse<{ deleted: boolean }>(
        mcp.client,
        "delete_attachment",
        {
          project: scenario.project.key,
          repository: scenario.project.repo.slug,
          attachmentId: uploaded.id,
        },
      );
      expect(deleted.deleted).toBe(true);

      // After deletion the content must be gone server-side, and a second
      // delete must surface the server's NoSuchObjectException as-is.
      const gone = await callRaw(mcp.client, "download_attachment", {
        project: scenario.project.key,
        repository: scenario.project.repo.slug,
        attachmentId: uploaded.id,
      });
      expect(gone.isError).toBe(true);

      const redel = await callRaw(mcp.client, "delete_attachment", {
        project: scenario.project.key,
        repository: scenario.project.repo.slug,
        attachmentId: uploaded.id,
      });
      expect(redel.isError).toBe(true);
      expect((redel.content[0] as { text: string }).text).toContain(
        "does not exist",
      );
    } finally {
      await rm(dir, { recursive: true, force: true });
    }
  });

  test("chunked-framed downloads report the real byte size", async ({
    bb,
    scenario,
  }) => {
    // Production serves attachment downloads behind a proxy that re-frames
    // large responses as chunked (no content-length). The vanilla container
    // always declares content-length, so this test routes the mcp server
    // through a re-framing proxy to reproduce the production framing. With
    // a header-derived size the tool reported 0 for a complete download.
    const bytes = randomBytes(16 * 1024);
    const dir = await mkdtemp(join(tmpdir(), "e2e-attach-"));
    let proxy: http.Server | undefined;
    try {
      const server = http.createServer(async (req, res) => {
        const headers: Record<string, string> = {};
        for (const [k, v] of Object.entries(req.headers)) {
          if (k !== "host" && k !== "connection" && typeof v === "string") {
            headers[k] = v;
          }
        }
        const chunks: Buffer[] = [];
        for await (const chunk of req) chunks.push(chunk as Buffer);
        const body = chunks.length > 0 ? Buffer.concat(chunks) : undefined;
        const upstream = await fetch(`${bb.url}${req.url}`, {
          method: req.method,
          headers,
          body,
        });
        const resHeaders: Record<string, string> = {};
        upstream.headers.forEach((v, k) => {
          if (k !== "content-length") resHeaders[k] = v;
        });
        res.writeHead(upstream.status, resHeaders);
        res.end(Buffer.from(await upstream.arrayBuffer()));
      });
      await new Promise<void>((resolve) => {
        server.listen(0, "127.0.0.1", resolve);
      });
      proxy = server;
      const address = server.address() as { port: number };
      const proxyUrl = `http://127.0.0.1:${address.port}`;

      const { client: proxiedMcp } = await setupMcpAgainst(
        bb,
        undefined,
        proxyUrl,
      );

      const bigPath = join(dir, "big.bin");
      await writeFile(bigPath, bytes);

      const uploaded = await callAndParse<{ id: string }>(
        proxiedMcp,
        "upload_attachment",
        {
          project: scenario.project.key,
          repository: scenario.project.repo.slug,
          filePath: bigPath,
        },
      );

      const download = await callAndParse<{
        attachmentId: string;
        contentType: string;
        size: number;
        savedTo: string;
      }>(proxiedMcp, "download_attachment", {
        project: scenario.project.key,
        repository: scenario.project.repo.slug,
        attachmentId: uploaded.id,
        filePath: join(dir, "downloaded.bin"),
      });

      expect(download.size).toBe(bytes.byteLength);
      expect(await readFile(download.savedTo)).toEqual(bytes);
    } finally {
      proxy?.close();
      await rm(dir, { recursive: true, force: true });
    }
  });

  test("delete_attachment without management permission surfaces the server error", async ({
    bb,
    mcp,
    scenario,
  }) => {
    // A user with no permissions on the repo cannot delete its attachments;
    // Bitbucket masks the repo as nonexistent for them.
    const limited = limitedUser();
    await bb.api.post("admin/users", {
      searchParams: {
        name: limited.name,
        password: limited.password,
        displayName: "Limited User",
        emailAddress: "limited@example.com",
      },
    });

    const limitedSession = await setupMcpAgainst(bb, {
      username: limited.name,
      password: limited.password,
    });
    try {
      const dir = await mkdtemp(join(tmpdir(), "e2e-attach-"));
      try {
        const textPath = join(dir, "notes.txt");
        await writeFile(textPath, "e2e attachment content\n");
        const uploaded = await callAndParse<{ id: string }>(
          mcp.client,
          "upload_attachment",
          {
            project: scenario.project.key,
            repository: scenario.project.repo.slug,
            filePath: textPath,
          },
        );

        const denied = await callRaw(
          limitedSession.client,
          "delete_attachment",
          {
            project: scenario.project.key,
            repository: scenario.project.repo.slug,
            attachmentId: uploaded.id,
          },
        );
        expect(denied.isError).toBe(true);
        expect(
          (denied.content[0] as { text: string }).text.length,
        ).toBeGreaterThan(0);

        // The admin cleans the attachment up afterwards.
        await callAndParse(mcp.client, "delete_attachment", {
          project: scenario.project.key,
          repository: scenario.project.repo.slug,
          attachmentId: uploaded.id,
        });
      } finally {
        await rm(dir, { recursive: true, force: true });
      }
    } finally {
      await limitedSession.close();
    }
  });
});
