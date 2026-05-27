/** Rimuove prefisso wake word «Onizuka» dal transcript (varianti italiane). */
export function stripOnizukaWakePrefix(transcript: string): string {
  return transcript
    .trim()
    .replace(/^onizuka[,!\s]+/i, "")
    .replace(/^ehi\s+onizuka[,!\s]+/i, "")
    .trim();
}

export function hasOnizukaWakeWord(transcript: string): boolean {
  return /^onizuka\b/i.test(transcript.trim()) || /^ehi\s+onizuka\b/i.test(transcript.trim());
}
