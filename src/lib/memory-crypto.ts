import { createCipheriv, createDecipheriv, randomBytes, scryptSync } from "crypto";
import type { MemorySensitivity } from "@prisma/client";

const PREFIX = "enc:v1:";

function deriveKey(raw: string): Buffer {
  return scryptSync(raw, "onizuka-memory", 32);
}

/** Chiave corrente + precedente (rotazione). */
export function encryptionKeyCandidates(): Buffer[] {
  const keys: Buffer[] = [];
  const current = process.env.ONIZUKA_MEMORY_ENCRYPTION_KEY?.trim();
  const previous = process.env.ONIZUKA_MEMORY_ENCRYPTION_KEY_PREVIOUS?.trim();
  if (current && current.length >= 16) keys.push(deriveKey(current));
  if (previous && previous.length >= 16 && previous !== current) {
    keys.push(deriveKey(previous));
  }
  return keys;
}

function encryptionKey(): Buffer | null {
  const keys = encryptionKeyCandidates();
  return keys[0] ?? null;
}

export function isMemoryEncryptionEnabled(): boolean {
  return encryptionKeyCandidates().length > 0;
}

export function isMemoryKeyRotationConfigured(): boolean {
  const current = process.env.ONIZUKA_MEMORY_ENCRYPTION_KEY?.trim();
  const previous = process.env.ONIZUKA_MEMORY_ENCRYPTION_KEY_PREVIOUS?.trim();
  return Boolean(current && previous && current.length >= 16 && previous.length >= 16);
}

export function shouldEncryptMemory(sensitivity: MemorySensitivity): boolean {
  return sensitivity === "HIGH" && isMemoryEncryptionEnabled();
}

function decryptPackedWithKey(packed: string, key: Buffer): string {
  const buf = Buffer.from(packed, "base64url");
  const iv = buf.subarray(0, 12);
  const tag = buf.subarray(12, 28);
  const data = buf.subarray(28);
  const decipher = createDecipheriv("aes-256-gcm", key, iv);
  decipher.setAuthTag(tag);
  return Buffer.concat([decipher.update(data), decipher.final()]).toString("utf8");
}

export function encryptMemoryContent(plain: string): { content: string; contentEncrypted: boolean } {
  const key = encryptionKey();
  if (!key) return { content: plain, contentEncrypted: false };

  const iv = randomBytes(12);
  const cipher = createCipheriv("aes-256-gcm", key, iv);
  const enc = Buffer.concat([cipher.update(plain, "utf8"), cipher.final()]);
  const tag = cipher.getAuthTag();
  const packed = Buffer.concat([iv, tag, enc]).toString("base64url");
  return { content: `${PREFIX}${packed}`, contentEncrypted: true };
}

export function decryptMemoryContent(content: string, contentEncrypted: boolean): string {
  if (!contentEncrypted || !content.startsWith(PREFIX)) return content;

  const keys = encryptionKeyCandidates();
  if (keys.length === 0) return "[contenuto cifrato — chiave non configurata]";

  const packed = content.slice(PREFIX.length);
  for (const key of keys) {
    try {
      return decryptPackedWithKey(packed, key);
    } catch {
      continue;
    }
  }
  return "[contenuto cifrato — decifratura fallita]";
}

export function prepareMemoryContentForStorage(
  plain: string,
  sensitivity: MemorySensitivity
): { content: string; contentEncrypted: boolean } {
  if (!shouldEncryptMemory(sensitivity)) {
    return { content: plain, contentEncrypted: false };
  }
  return encryptMemoryContent(plain);
}

export function readMemoryContentPlain(
  content: string,
  contentEncrypted: boolean
): string {
  return decryptMemoryContent(content, contentEncrypted);
}
