import { createCipheriv, createDecipheriv, createHash, randomBytes } from "crypto";

const ALGO = "aes-256-gcm";

function deriveKey(): Buffer {
  const secret = process.env.NEXTAUTH_SECRET?.trim();
  if (!secret || secret.length < 32) {
    throw new Error("NEXTAUTH_SECRET mancante o troppo corto per cifratura token.");
  }
  return createHash("sha256").update(secret).digest();
}

export function encryptJson(payload: object): string {
  const key = deriveKey();
  const iv = randomBytes(12);
  const cipher = createCipheriv(ALGO, key, iv);
  const plain = JSON.stringify(payload);
  const enc = Buffer.concat([cipher.update(plain, "utf8"), cipher.final()]);
  const tag = cipher.getAuthTag();
  return Buffer.concat([iv, tag, enc]).toString("base64url");
}

export function decryptJson<T>(cipherText: string): T {
  const key = deriveKey();
  const buf = Buffer.from(cipherText, "base64url");
  const iv = buf.subarray(0, 12);
  const tag = buf.subarray(12, 28);
  const enc = buf.subarray(28);
  const decipher = createDecipheriv(ALGO, key, iv);
  decipher.setAuthTag(tag);
  const plain = Buffer.concat([decipher.update(enc), decipher.final()]).toString("utf8");
  return JSON.parse(plain) as T;
}
