"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { requireAdminArea } from "@/lib/admin-session";
import { prisma } from "@/lib/prisma";
import { dayBucket } from "@/lib/analytics-store";
import type { AnalyticsSource } from "@prisma/client";

const SOCIAL_SOURCES = ["INSTAGRAM", "FACEBOOK", "LINKEDIN", "TIKTOK", "YOUTUBE", "GBP"];

export async function addCompetitor(
  _prev: unknown,
  formData: FormData
): Promise<{ error: string } | null> {
  await requireAdminArea();
  const clientId = (formData.get("clientId") as string)?.trim();
  const platform = (formData.get("platform") as string)?.trim();
  const name = (formData.get("name") as string)?.trim();
  const handle = (formData.get("handle") as string)?.trim() || null;

  if (!clientId || !platform || !name) return { error: "Cliente, piattaforma e nome sono obbligatori." };
  if (!SOCIAL_SOURCES.includes(platform)) return { error: "Piattaforma non valida." };

  await prisma.competitor.create({
    data: { clientId, platform: platform as AnalyticsSource, name, handle },
  });
  revalidatePath("/admin/analytics/competitors");
  redirect(`/admin/analytics/competitors?clientId=${clientId}`);
}

export async function recordCompetitorSnapshot(formData: FormData) {
  await requireAdminArea();
  const competitorId = (formData.get("competitorId") as string)?.trim();
  const followers = Number((formData.get("followers") as string)?.trim());
  if (!competitorId || !Number.isFinite(followers) || followers < 0) return;

  const date = dayBucket(new Date());
  await prisma.competitorSnapshot.upsert({
    where: { competitorId_date: { competitorId, date } },
    create: { competitorId, date, followers: Math.round(followers) },
    update: { followers: Math.round(followers) },
  });
  revalidatePath("/admin/analytics/competitors");
}

export async function deleteCompetitor(formData: FormData) {
  await requireAdminArea();
  const id = (formData.get("id") as string)?.trim();
  if (!id) return;
  await prisma.competitor.deleteMany({ where: { id } });
  revalidatePath("/admin/analytics/competitors");
}
