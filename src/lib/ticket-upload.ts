export const TICKET_MAX_FILES = 3;
export const TICKET_MAX_BYTES = 5 * 1024 * 1024;

const ALLOWED_MIMES = new Set([
  "image/jpeg",
  "image/png",
  "image/gif",
  "image/webp",
  "application/pdf",
]);

export function sanitizeTicketFilename(name: string, index: number): string {
  const ext = name.replace(/^.*\.([^.]+)$/, "$1").toLowerCase() || "bin";
  const base = name.replace(/\.[^.]+$/, "").replace(/[^a-zA-Z0-9._-]/g, "_").slice(0, 60);
  return `${base || "file"}-${index}.${ext}`;
}

export function validateTicketFiles(files: File[]): string | null {
  if (files.length > TICKET_MAX_FILES) {
    return `Massimo ${TICKET_MAX_FILES} allegati.`;
  }
  for (const f of files) {
    const mime = f.type || "application/octet-stream";
    if (!ALLOWED_MIMES.has(mime)) {
      return "Formati ammessi: immagini e PDF.";
    }
    if (f.size > TICKET_MAX_BYTES) {
      return "Ogni file max 5 MB.";
    }
  }
  return null;
}
