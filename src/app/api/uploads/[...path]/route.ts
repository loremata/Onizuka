/**
 * Serve file da filesystem solo in sviluppo o con ALLOW_LOCAL_UPLOAD_SERVE=1 in produzione.
 * In produzione standard gli URL devono puntare a S3/R2 (S3_PUBLIC_URL).
 */
import { NextResponse } from "next/server";
import { readFile } from "fs/promises";
import path from "path";
import { getServerSession } from "next-auth";
import { ApiErrorCode, jsonApiError } from "@/lib/api-json-errors";
import { authOptions } from "@/lib/auth";
import { allowsLocalUploadFilesystemInProduction } from "@/lib/storage";

export const dynamic = "force-dynamic";

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

function localUploadApiEnabled(): boolean {
  if (process.env.NODE_ENV !== "production") return true;
  return allowsLocalUploadFilesystemInProduction();
}

export async function GET(
  _req: Request,
  { params }: { params: Promise<{ path: string[] }> }
) {
  if (!localUploadApiEnabled()) {
    return jsonApiError(
      404,
      ApiErrorCode.LOCAL_UPLOAD_DISABLED,
      "API upload locale disattivata in produzione. I media sono serviti dallo storage oggetti (S3_PUBLIC_URL)."
    );
  }

  const session = await getServerSession(authOptions);
  if (!session) {
    return jsonApiError(401, ApiErrorCode.UNAUTHORIZED, "Non autorizzato");
  }

  const { path: pathSegments } = await params;
  const segments = Array.isArray(pathSegments) ? pathSegments : pathSegments ? [pathSegments] : [];
  if (!segments.length) return jsonApiError(404, ApiErrorCode.NOT_FOUND, "Non trovato");

  const clientIdFromKey = segments[0];
  if (session.user.role === "CLIENT") {
    if (!session.user.clientId || session.user.clientId !== clientIdFromKey) {
      return jsonApiError(403, ApiErrorCode.FORBIDDEN, "Accesso negato");
    }
  } else if (session.user.role !== "ADMIN") {
    return jsonApiError(403, ApiErrorCode.FORBIDDEN, "Accesso negato");
  }

  const safeSegments = segments.map((s) => s.replace(/\.\./g, ""));
  const filePath = path.resolve(UPLOADS_DIR, ...safeSegments);
  const uploadsRoot = path.resolve(UPLOADS_DIR);
  if (!filePath.startsWith(uploadsRoot)) {
    return jsonApiError(403, ApiErrorCode.FORBIDDEN, "Accesso negato");
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
    return jsonApiError(404, ApiErrorCode.NOT_FOUND, "Non trovato");
  }
}
