/**
 * Storage abstraction: S3-compatible (R2 / AWS S3) or filesystem fallback for local dev.
 * When S3_* env vars are set, uses S3; otherwise writes to local UPLOADS_DIR (default .uploads).
 */

import { S3Client, PutObjectCommand } from "@aws-sdk/client-s3";
import { writeFile, mkdir } from "fs/promises";
import path from "path";

const UPLOADS_DIR = process.env.UPLOADS_DIR ?? path.join(process.cwd(), ".uploads");

/** Self-hosted: consenti filesystem in produzione solo se esplicito (VPS con disco persistente). */
export function allowsLocalUploadFilesystemInProduction(): boolean {
  return process.env.ALLOW_LOCAL_UPLOAD_SERVE === "1";
}

export function isS3Configured(): boolean {
  return !!(
    process.env.S3_BUCKET &&
    process.env.S3_ACCESS_KEY &&
    process.env.S3_SECRET_KEY
  );
}

/** In produzione serve S3/R2, oppure `ALLOW_LOCAL_UPLOAD_SERVE=1` per disco locale + `/api/uploads`. */
function ensureStorageConfigured(): void {
  if (process.env.NODE_ENV !== "production") return;
  if (isS3Configured()) return;
  if (allowsLocalUploadFilesystemInProduction()) return;
  throw new Error(
    "Storage: in production S3 (or R2) is required. Set S3_BUCKET, S3_ACCESS_KEY, and S3_SECRET_KEY, or set ALLOW_LOCAL_UPLOAD_SERVE=1 only if usi un VPS con disco persistente e sai cosa fai."
  );
}

/** All’avvio server: fallisce subito se la prod non ha né S3 né opt-in locale. */
export function assertProductionStorageEnv(): void {
  if (process.env.NODE_ENV !== "production") return;
  if (isS3Configured()) return;
  if (allowsLocalUploadFilesystemInProduction()) return;
  throw new Error(
    "[storage] In produzione imposta S3_BUCKET, S3_ACCESS_KEY, S3_SECRET_KEY oppure ALLOW_LOCAL_UPLOAD_SERVE=1 per storage su filesystem."
  );
}

export type UploadResult = {
  url: string;
  thumbnailUrl?: string;
  filename: string;
  mimeType: string;
  sizeBytes: number;
};

/**
 * Upload a file buffer to storage. Key format: clientId/postItemId/sanitizedFilename
 */
export async function uploadFile(
  buffer: Buffer,
  key: string,
  mimeType: string,
  sizeBytes: number
): Promise<UploadResult> {
  ensureStorageConfigured();
  const filename = path.basename(key);

  if (isS3Configured()) {
    const client = new S3Client({
      region: process.env.S3_REGION ?? "auto",
      endpoint: process.env.S3_ENDPOINT ?? undefined,
      credentials: {
        accessKeyId: process.env.S3_ACCESS_KEY!,
        secretAccessKey: process.env.S3_SECRET_KEY!,
      },
      forcePathStyle: !!process.env.S3_FORCE_PATH_STYLE,
    });

    const bucket = process.env.S3_BUCKET!;
    await client.send(
      new PutObjectCommand({
        Bucket: bucket,
        Key: key,
        Body: buffer,
        ContentType: mimeType,
      })
    );

    // Public URL or path-style URL for R2/S3
    const baseUrl = process.env.S3_PUBLIC_URL;
    const url = baseUrl
      ? `${baseUrl.replace(/\/$/, "")}/${key}`
      : `https://${bucket}.s3.${process.env.S3_REGION ?? "us-east-1"}.amazonaws.com/${key}`;

    return { url, filename, mimeType, sizeBytes };
  }

  // Filesystem fallback
  const dir = path.join(UPLOADS_DIR, path.dirname(key));
  await mkdir(dir, { recursive: true });
  const filePath = path.join(UPLOADS_DIR, key);
  await writeFile(filePath, buffer);

  // URL served by our API route
  const url = `/api/uploads/${key}`;
  return { url, filename, mimeType, sizeBytes };
}
