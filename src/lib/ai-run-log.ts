import { prisma } from "@/lib/prisma";

export type AiRunKind = "ask" | "assistant_chat" | "memory_rag" | "audit_batch" | "other";

export async function logAiRun(params: {
  ownerUserId: string;
  kind: AiRunKind;
  status?: "completed" | "failed";
  inputSummary?: string;
  outputSummary?: string;
  errorDetail?: string;
}): Promise<void> {
  try {
    await prisma.aiRun.create({
      data: {
        ownerUserId: params.ownerUserId,
        kind: params.kind,
        status: params.status ?? "completed",
        inputSummary: params.inputSummary?.slice(0, 2000) ?? null,
        outputSummary: params.outputSummary?.slice(0, 2000) ?? null,
        errorDetail: params.errorDetail?.slice(0, 2000) ?? null,
      },
    });
  } catch {
    /* non-blocking */
  }
}
