import { readFileSync } from "fs";
import path from "path";
import { prisma } from "@/lib/prisma";
import { createPostWithMedia } from "@/lib/post-media-upload";
import { isS3Configured } from "@/lib/storage";

describe("createPostWithMedia (locale)", () => {
  it("crea post con media su storage locale", async () => {
    if (isS3Configured()) return;

    const client = await prisma.client.findFirst({
      where: { slug: "demo-client" },
      select: { id: true },
    });
    const admin = await prisma.user.findFirst({
      where: { email: "admin@agency.com" },
      select: { id: true },
    });
    if (!client || !admin) return;

    const png = readFileSync(path.join(process.cwd(), "e2e/fixtures/test.png"));
    const file = new File([png], "probe-upload.png", { type: "image/png" });

    const result = await createPostWithMedia({
      clientId: client.id,
      platform: "INSTAGRAM",
      captionText: "probe passi-mancanti",
      scheduledFor: null,
      createdByUserId: admin.id,
      awaitingClientReview: false,
      files: [file],
    });

    expect(result.ok).toBe(true);
    if (!result.ok) return;

    const assets = await prisma.mediaAsset.count({
      where: { postItemId: result.postId },
    });
    expect(assets).toBe(1);

    await prisma.postItem.delete({ where: { id: result.postId } });
  });
});
