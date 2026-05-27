import { prisma } from "@/lib/prisma";
import { uploadFile } from "@/lib/storage";
import type { Platform } from "@prisma/client";

const IMAGE_MIMES = new Set(["image/jpeg", "image/png", "image/gif", "image/webp"]);
const VIDEO_MIMES = new Set(["video/mp4", "video/webm"]);

export function sanitizePostFilename(name: string, index: number): string {
  const ext = name.replace(/^.*\.([^.]+)$/, "$1").toLowerCase() || "bin";
  const base = name.replace(/\.[^.]+$/, "").replace(/[^a-zA-Z0-9._-]/g, "_").slice(0, 80);
  return `${base || "file"}-${index}.${ext}`;
}

export type CreatePostWithMediaInput = {
  clientId: string;
  platform: Platform;
  captionText: string;
  scheduledFor: Date | null;
  createdByUserId: string;
  awaitingClientReview: boolean;
  files: File[];
};

export async function createPostWithMedia(
  input: CreatePostWithMediaInput
): Promise<{ ok: true; postId: string } | { ok: false; error: string }> {
  if (input.files.length === 0) {
    return { ok: false, error: "È richiesto almeno un file multimediale." };
  }

  const post = await prisma.postItem.create({
    data: {
      clientId: input.clientId,
      platform: input.platform,
      captionText: input.captionText,
      scheduledFor: input.scheduledFor,
      createdByUserId: input.createdByUserId,
      awaitingClientReview: input.awaitingClientReview,
    },
  });

  for (let i = 0; i < input.files.length; i++) {
    const file = input.files[i];
    const mime = file.type || "application/octet-stream";
    const isImage = IMAGE_MIMES.has(mime);
    const isVideo = VIDEO_MIMES.has(mime);
    const type = isImage ? "IMAGE" : isVideo ? "VIDEO" : "IMAGE";

    const filename = sanitizePostFilename(file.name, i);
    const key = `${input.clientId}/${post.id}/${filename}`;
    const buffer = Buffer.from(await file.arrayBuffer());

    try {
      const result = await uploadFile(buffer, key, mime, file.size);
      await prisma.mediaAsset.create({
        data: {
          postItemId: post.id,
          type,
          url: result.url,
          thumbnailUrl: result.thumbnailUrl ?? null,
          filename: result.filename,
          mimeType: result.mimeType,
          sizeBytes: result.sizeBytes,
        },
      });
    } catch (e) {
      console.error(e);
      await prisma.postItem.delete({ where: { id: post.id } });
      return { ok: false, error: "Caricamento di uno o più file non riuscito." };
    }
  }

  return { ok: true, postId: post.id };
}
