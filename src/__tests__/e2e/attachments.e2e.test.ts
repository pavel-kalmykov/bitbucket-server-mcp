import { expect } from "vitest";
import { mkdtemp, rm, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { callAndParse } from "../tool-test-utils.js";
import { test, describeBitbucket } from "./e2e-suite.js";

// 1x1 transparent PNG; enough for upload_attachment to pick the image
// markdown shape and for Bitbucket to store the file.
const PNG_BYTES = Uint8Array.from([
  0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a, 0x00, 0x00, 0x00, 0x0d, 0x49,
  0x48, 0x44, 0x52, 0x00, 0x00, 0x00, 0x01, 0x00, 0x00, 0x00, 0x01, 0x08, 0x06,
  0x00, 0x00, 0x00, 0x1f, 0x15, 0xc4, 0x89, 0x00, 0x00, 0x00, 0x0a, 0x49, 0x44,
  0x41, 0x54, 0x78, 0x9c, 0x63, 0x00, 0x01, 0x00, 0x00, 0x05, 0x00, 0x01, 0x0d,
  0x0a, 0x2d, 0xb4, 0x00, 0x00, 0x00, 0x00, 0x49, 0x45, 0x4e, 0x44, 0xae, 0x42,
  0x60, 0x82,
]);

describeBitbucket("attachments", () => {
  test("upload_attachment posts to the unprefixed attachments endpoint", async ({
    mcp,
    scenario,
    bb,
  }) => {
    const dir = await mkdtemp(join(tmpdir(), "e2e-attach-"));
    try {
      const textPath = join(dir, "notes.txt");
      await writeFile(textPath, "e2e attachment content\n");

      const uploaded = await callAndParse<{
        id: number;
        url: string;
        ref: string;
        markdown: string;
      }>(mcp.client, "upload_attachment", {
        project: scenario.project.key,
        repository: scenario.project.repo.slug,
        filePath: textPath,
      });

      expect(uploaded.ref).toMatch(/^attachment:\d+\/\d+$/);
      expect(uploaded.markdown).toBe(`[notes.txt](${uploaded.ref})`);

      // The upload must be readable server-side, content included.
      const content = await bb.api
        .get(
          `projects/${scenario.project.key}/repos/${scenario.project.repo.slug}/attachments/${uploaded.id}`,
        )
        .text();
      expect(content).toBe("e2e attachment content\n");

      await bb.api.delete(
        `projects/${scenario.project.key}/repos/${scenario.project.repo.slug}/attachments/${uploaded.id}`,
      );
    } finally {
      await rm(dir, { recursive: true, force: true });
    }
  });

  test("image uploads get inline markdown", async ({ mcp, scenario, bb }) => {
    const dir = await mkdtemp(join(tmpdir(), "e2e-attach-"));
    try {
      const imagePath = join(dir, "dot.png");
      await writeFile(imagePath, PNG_BYTES);

      const uploaded = await callAndParse<{
        id: number;
        ref: string;
        markdown: string;
      }>(mcp.client, "upload_attachment", {
        project: scenario.project.key,
        repository: scenario.project.repo.slug,
        filePath: imagePath,
      });

      expect(uploaded.markdown).toBe(`![dot.png](${uploaded.ref})`);

      await bb.api.delete(
        `projects/${scenario.project.key}/repos/${scenario.project.repo.slug}/attachments/${uploaded.id}`,
      );
    } finally {
      await rm(dir, { recursive: true, force: true });
    }
  });
});
