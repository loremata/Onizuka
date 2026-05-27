import { uploadFile } from "@/lib/storage";

const MAX_BYTES = 8 * 1024 * 1024;
const ALLOWED = new Set([
  "application/pdf",
  "image/jpeg",
  "image/png",
  "image/webp",
]);

export async function uploadReferrerPayoutDocument(
  referrerId: string,
  file: File
): Promise<{ url: string } | { error: string }> {
  if (!file.size) return { error: "File vuoto." };
  if (file.size > MAX_BYTES) return { error: "File troppo grande (max 8 MB)." };

  const mime = file.type || "application/octet-stream";
  if (!ALLOWED.has(mime)) {
    return { error: "Formato non supportato (PDF, JPG, PNG, WebP)." };
  }

  const safeName = file.name.replace(/[^\w.\-]+/g, "_").slice(0, 80) || "documento";
  const key = `referrers/${referrerId}/payouts/${Date.now()}-${safeName}`;

  try {
    const buffer = Buffer.from(await file.arrayBuffer());
    const result = await uploadFile(buffer, key, mime, file.size);
    return { url: result.url };
  } catch {
    return { error: "Caricamento documento non riuscito." };
  }
}
