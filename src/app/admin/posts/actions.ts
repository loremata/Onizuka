"use server";

import { redirect } from "next/navigation";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { uploadFile } from "@/lib/storage";
import type { Platform } from "@prisma/client";

type ActionResult = { error: string } | null;

async function ensureAdmin() {
  const session = await getServerSession(authOptions);
  if (!session || session.user.role !== "ADMIN") redirect("/login");
  return session;
}

const IMAGE_MIMES = new Set(["image/jpeg", "image/png", "image/gif", "image/webp"]);
const VIDEO_MIMES = new Set(["video/mp4", "video/webm"]);

function sanitizeFilename(name: string, index: number): string {
  const ext = name.replace(/^.*\.([^.]+)$/, "$1").toLowerCase() || "bin";
  const base = name.replace(/\.[^.]+$/, "").replace(/[^a-zA-Z0-9._-]/g, "_").slice(0, 80);
  return `${base || "file"}-${index}.${ext}`;
}

export async function createPost(
  _prev: unknown,
  formData: FormData
): Promise<ActionResult> {
  const session = await ensureAdmin();

  const clientId = (formData.get("clientId") as string)?.trim();
  const platform = (formData.get("platform") as Platform) || "FACEBOOK";
  const captionText = (formData.get("captionText") as string)?.trim() ?? "";
  const scheduledForRaw = (formData.get("scheduledFor") as string)?.trim();

  if (!clientId) return { error: "Client is required." };

  const validPlatforms: Platform[] = ["FACEBOOK", "INSTAGRAM", "LINKEDIN", "GBP"];
  if (!validPlatforms.includes(platform)) return { error: "Invalid platform." };

  const scheduledFor = scheduledForRaw
    ? new Date(scheduledForRaw)
    : null;
  if (scheduledForRaw && isNaN(scheduledFor!.getTime()))
    return { error: "Invalid scheduled date." };

  const client = await prisma.client.findUnique({ where: { id: clientId } });
  if (!client) return { error: "Client not found." };

  const files = formData.getAll("media").filter((f): f is File => f instanceof File && f.size > 0);
  if (files.length === 0) return { error: "At least one media file is required." };

  const post = await prisma.postItem.create({
    data: {
      clientId,
      platform,
      captionText,
      scheduledFor,
      createdByUserId: session.user.id,
    },
  });

  for (let i = 0; i < files.length; i++) {
    const file = files[i];
    const mime = file.type || "application/octet-stream";
    const isImage = IMAGE_MIMES.has(mime);
    const isVideo = VIDEO_MIMES.has(mime);
    const type = isImage ? "IMAGE" : isVideo ? "VIDEO" : "IMAGE";

    const filename = sanitizeFilename(file.name, i);
    const key = `${clientId}/${post.id}/${filename}`;
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
      return { error: "Failed to upload one or more files." };
    }
  }

  redirect("/admin/posts");
}
