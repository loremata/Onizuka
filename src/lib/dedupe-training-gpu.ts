import { exportDedupeTrainingDataset, importDedupeModelWeights, trainAndApplyDedupeModel } from "@/lib/client-dedupe-training";
import { uploadDedupeTrainingJsonl } from "@/lib/storage-dedupe-export";
import { prisma } from "@/lib/prisma";
import type { DedupeTrainingJobStatus } from "@prisma/client";

export function isDedupeGpuWebhookEnabled(): boolean {
  return !!process.env.DEDUPE_GPU_WEBHOOK_URL?.trim();
}

/** Accoda job training GPU (export dataset + webhook oppure cron CPU fallback). */
export async function enqueueDedupeGpuTrainingJob(params?: {
  datasetLimit?: number;
}): Promise<{ jobId: string; pairsCount: number } | { error: string }> {
  const limit = params?.datasetLimit ?? 2000;
  const { records } = await exportDedupeTrainingDataset(limit);
  if (records.length < 3) {
    return { error: "Dataset insufficiente per job GPU (min 3 coppie)." };
  }

  const jsonl = records.map((r) => JSON.stringify(r)).join("\n");
  const job = await prisma.dedupeTrainingJob.create({
    data: {
      status: "PENDING",
      pairsCount: records.length,
      gpuWebhookUrl: process.env.DEDUPE_GPU_WEBHOOK_URL?.trim() || null,
    },
  });

  const uploaded = await uploadDedupeTrainingJsonl(job.id, jsonl);
  if (uploaded) {
    await prisma.dedupeTrainingJob.update({
      where: { id: job.id },
      data: { datasetS3Key: uploaded.key, datasetUrl: uploaded.url },
    });
  } else {
    await prisma.dedupeTrainingJob.update({
      where: { id: job.id },
      data: { datasetUrl: `inline:${records.length}` },
    });
  }

  return { jobId: job.id, pairsCount: records.length };
}

async function setJobStatus(
  id: string,
  status: DedupeTrainingJobStatus,
  extra?: { errorDetail?: string; weightsVersion?: number }
): Promise<void> {
  await prisma.dedupeTrainingJob.update({
    where: { id },
    data: {
      status,
      ...(status === "RUNNING" ? { startedAt: new Date() } : {}),
      ...(status === "DONE" || status === "FAILED" ? { completedAt: new Date() } : {}),
      ...(extra?.errorDetail !== undefined ? { errorDetail: extra.errorDetail } : {}),
      ...(extra?.weightsVersion !== undefined ? { weightsVersion: extra.weightsVersion } : {}),
    },
  });
}

/** Invia job a worker GPU esterno via webhook. */
async function dispatchGpuWebhook(jobId: string, datasetUrl: string | null): Promise<boolean> {
  const url = process.env.DEDUPE_GPU_WEBHOOK_URL?.trim();
  if (!url) return false;

  const secret = process.env.DEDUPE_GPU_WEBHOOK_SECRET?.trim();
  const res = await fetch(url, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      ...(secret ? { "X-Dedupe-Gpu-Secret": secret } : {}),
    },
    body: JSON.stringify({
      jobId,
      datasetUrl,
      callbackUrl: `${process.env.NEXTAUTH_URL?.replace(/\/$/, "")}/api/admin/crm/dedupe/training/gpu-callback`,
    }),
  });
  return res.ok;
}

/** Processa un job PENDING (webhook GPU o fallback train CPU massivo). */
export async function processNextDedupeGpuTrainingJob(): Promise<{
  processed: boolean;
  jobId?: string;
  status?: string;
  error?: string;
}> {
  const job = await prisma.dedupeTrainingJob.findFirst({
    where: { status: "PENDING" },
    orderBy: { createdAt: "asc" },
  });
  if (!job) return { processed: false };

  await setJobStatus(job.id, "RUNNING");

  try {
    if (isDedupeGpuWebhookEnabled() && job.datasetUrl && !job.datasetUrl.startsWith("inline:")) {
      const sent = await dispatchGpuWebhook(job.id, job.datasetUrl);
      if (sent) {
        return { processed: true, jobId: job.id, status: "RUNNING", error: undefined };
      }
    }

    const trained = await trainAndApplyDedupeModel({
      datasetLimit: Math.min(3000, job.pairsCount + 500),
      backfillLimit: 1500,
    });
    if ("error" in trained) {
      await setJobStatus(job.id, "FAILED", { errorDetail: trained.error });
      return { processed: true, jobId: job.id, status: "FAILED", error: trained.error };
    }

    await setJobStatus(job.id, "DONE", { weightsVersion: trained.version });
    return { processed: true, jobId: job.id, status: "DONE" };
  } catch (e) {
    const msg = e instanceof Error ? e.message : String(e);
    await setJobStatus(job.id, "FAILED", { errorDetail: msg.slice(0, 2000) });
    return { processed: true, jobId: job.id, status: "FAILED", error: msg };
  }
}

/** Callback worker GPU esterno con pesi addestrati. */
export async function completeDedupeGpuTrainingJob(params: {
  jobId: string;
  weightsJson: string;
  secret?: string;
}): Promise<{ ok: true; version: number } | { error: string }> {
  const expected = process.env.DEDUPE_GPU_WEBHOOK_SECRET?.trim();
  if (expected && params.secret !== expected) {
    return { error: "Secret webhook non valido." };
  }

  const job = await prisma.dedupeTrainingJob.findUnique({ where: { id: params.jobId } });
  if (!job) return { error: "Job non trovato." };

  const imported = await importDedupeModelWeights({
    weightsJson: params.weightsJson,
    notes: `GPU callback job ${params.jobId}`,
  });
  if ("error" in imported) {
    await setJobStatus(params.jobId, "FAILED", { errorDetail: imported.error });
    return imported;
  }

  await setJobStatus(params.jobId, "DONE", { weightsVersion: imported.version });
  return { ok: true, version: imported.version };
}

export async function listRecentDedupeTrainingJobs(limit = 10) {
  return prisma.dedupeTrainingJob.findMany({
    orderBy: { createdAt: "desc" },
    take: limit,
  });
}
