/**
 * Serves uploaded files from local filesystem (dev only).
 * In production, configure S3/R2 so media URLs point to object storage; this route is not used for new uploads.
 */
import { NextResponse } from "next/server";
import { readFile } from "fs/promises";
import path from "path";

const UPLOADS_DIR = process.env.UPLOADS_DIR ?? path.join(process.cwd(), ".uploads");

const MIME: Record<string, string> = {
  ".jpg": "image/jpeg",
  ".jpeg": "image/jpeg",
  ".png": "image/png",
  ".gif": "image/gif",
  ".webp": "image/webp",
  ".mp4": "video/mp4",
  ".webm": "video/webm",
};

export async function GET(
  _req: Request,
  { params }: { params: Promise<{ path: string[] }> }
) {
  const { path: pathSegments } = await params;
  const segments = Array.isArray(pathSegments) ? pathSegments : pathSegments ? [pathSegments] : [];
  if (!segments.length) return NextResponse.json({ error: "Not found" }, { status: 404 });

  const safeSegments = segments.map((s) => s.replace(/\.\./g, ""));
  const filePath = path.resolve(UPLOADS_DIR, ...safeSegments);
  const uploadsRoot = path.resolve(UPLOADS_DIR);
  if (!filePath.startsWith(uploadsRoot)) {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }

  try {
    const buffer = await readFile(filePath);
    const ext = path.extname(filePath).toLowerCase();
    const contentType = MIME[ext] ?? "application/octet-stream";
    return new NextResponse(buffer, {
      headers: {
        "Content-Type": contentType,
        "Cache-Control": "private, max-age=86400",
      },
    });
  } catch {
    return NextResponse.json({ error: "Not found" }, { status: 404 });
  }
}
