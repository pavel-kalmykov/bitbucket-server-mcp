import { mkdtemp, readFile, rm, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { randomUUID } from "node:crypto";
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

  test("delete_attachment without management permission surfaces the server error", async ({
    bb,
    mcp,
    scenario,
  }) => {
    // A user with no permissions on the repo cannot delete its attachments;
    // Bitbucket masks the repo as nonexistent for them.
    const limited = {
      name: `limited-${randomUUID().slice(0, 8)}`,
      password: "limited-password",
    };
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
