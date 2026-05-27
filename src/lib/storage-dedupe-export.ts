import { PutObjectCommand, S3Client } from "@aws-sdk/client-s3";
import { isS3Configured } from "@/lib/storage";

/** Carica dataset JSONL training dedupe su S3/R2. */
export async function uploadDedupeTrainingJsonl(
  jobId: string,
  jsonl: string
): Promise<{ key: string; url: string } | null> {
  if (!isS3Configured()) return null;

  const client = new S3Client({
    region: process.env.S3_REGION ?? "auto",
    endpoint: process.env.S3_ENDPOINT ?? undefined,
    credentials: {
      accessKeyId: process.env.S3_ACCESS_KEY!,
      secretAccessKey: process.env.S3_SECRET_KEY!,
    },
    forcePathStyle: !!process.env.S3_FORCE_PATH_STYLE,
  });

  const key = `dedupe-training/${jobId}.jsonl`;
  const bucket = process.env.S3_BUCKET!;
  await client.send(
    new PutObjectCommand({
      Bucket: bucket,
      Key: key,
      Body: Buffer.from(jsonl, "utf8"),
      ContentType: "application/x-ndjson",
    })
  );

  const baseUrl = process.env.S3_PUBLIC_URL;
  const url = baseUrl
    ? `${baseUrl.replace(/\/$/, "")}/${key}`
    : `s3://${bucket}/${key}`;

  return { key, url };
}
