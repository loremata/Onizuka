import { prisma } from "@/lib/prisma";
import { uploadFile } from "@/lib/storage";
import { sanitizeTicketFilename, validateTicketFiles } from "@/lib/ticket-upload";

export async function saveTicketAttachments(params: {
  ticketId: string;
  clientId: string;
  updateId?: string | null;
  files: File[];
  uploadedByUserId: string;
}): Promise<string | null> {
  const { ticketId, clientId, updateId, files, uploadedByUserId } = params;
  if (files.length === 0) return null;

  const fileError = validateTicketFiles(files);
  if (fileError) return fileError;

  for (let i = 0; i < files.length; i++) {
    const file = files[i];
    const mime = file.type || "application/octet-stream";
    const filename = sanitizeTicketFilename(file.name, i);
    const key = `tickets/${clientId}/${ticketId}/${updateId ?? "root"}/${filename}`;
    const buffer = Buffer.from(await file.arrayBuffer());

    try {
      const result = await uploadFile(buffer, key, mime, file.size);
      await prisma.clientTicketAttachment.create({
        data: {
          ticketId,
          updateId: updateId ?? null,
          filename: result.filename,
          url: result.url,
          mimeType: result.mimeType,
          sizeBytes: result.sizeBytes,
          uploadedByUserId,
        },
      });
    } catch {
      return "Caricamento allegato non riuscito.";
    }
  }

  return null;
}
