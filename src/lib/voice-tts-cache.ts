import { createHash } from "crypto";
import { access, mkdir, readFile, writeFile } from "fs/promises";
import path from "path";

const CACHE_DIR = path.join(process.cwd(), ".cache", "voice-tts");

export function isVoiceTtsCacheEnabled(): boolean {
  const v = process.env.VOICE_TTS_CACHE?.trim().toLowerCase();
  if (v === "0" || v === "false") return false;
  return true;
}

export function voiceTtsCacheKey(text: string, model: string, voice: string): string {
  return createHash("sha256").update(`${model}\0${voice}\0${text}`).digest("hex");
}

function cacheFilePath(key: string): string {
  return path.join(CACHE_DIR, `${key}.mp3`);
}

export async function readVoiceTtsCache(key: string): Promise<Buffer | null> {
  if (!isVoiceTtsCacheEnabled()) return null;
  try {
    await access(cacheFilePath(key));
    return await readFile(cacheFilePath(key));
  } catch {
    return null;
  }
}

export async function writeVoiceTtsCache(key: string, buffer: Buffer): Promise<void> {
  if (!isVoiceTtsCacheEnabled()) return;
  await mkdir(CACHE_DIR, { recursive: true });
  await writeFile(cacheFilePath(key), buffer);
}
