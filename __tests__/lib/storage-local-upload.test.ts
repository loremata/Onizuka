import { mkdtemp, rm } from "fs/promises";
import { tmpdir } from "os";
import path from "path";
import { uploadFile, isS3Configured } from "@/lib/storage";

describe("storage locale (dev)", () => {
  const prevUploadsDir = process.env.UPLOADS_DIR;

  afterEach(async () => {
    if (prevUploadsDir === undefined) delete process.env.UPLOADS_DIR;
    else process.env.UPLOADS_DIR = prevUploadsDir;
  });

  it("scrive su filesystem quando S3 non è configurato", async () => {
    if (isS3Configured()) {
      return;
    }
    const dir = await mkdtemp(path.join(tmpdir(), "onizuka-upload-"));
    process.env.UPLOADS_DIR = dir;
    try {
      const result = await uploadFile(
        Buffer.from("probe"),
        "demo-client/post/probe.txt",
        "text/plain",
        5
      );
      expect(result.url).toContain("/api/uploads/");
      expect(result.filename).toBe("probe.txt");
    } finally {
      await rm(dir, { recursive: true, force: true });
    }
  });
});
