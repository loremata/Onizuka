import { NextRequest, NextResponse } from "next/server";
import { jsonApiError } from "@/lib/api-json-errors";
import type { Session } from "next-auth";
import { requireAdminApiSession } from "@/lib/api-admin-auth";
import { prisma } from "@/lib/prisma";

export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const session = await requireAdminApiSession("/admin/posts");
  if (session instanceof NextResponse) return session;

  const { id } = await params;
  const body = (await request.json().catch(() => ({}))) as {
    publishUrl?: string;
    impressions?: number;
    reach?: number;
    engagement?: number;
  };

  const post = await prisma.postItem.findUnique({ where: { id } });
  if (!post) return jsonApiError(404, "NOT_FOUND", "Post non trovato.");

  const updated = await prisma.postItem.update({
    where: { id },
    data: {
      publishedAt: new Date(),
      publishUrl: body.publishUrl?.trim() || null,
      impressions: typeof body.impressions === "number" ? Math.max(0, Math.floor(body.impressions)) : undefined,
      reach: typeof body.reach === "number" ? Math.max(0, Math.floor(body.reach)) : undefined,
      engagement: typeof body.engagement === "number" ? Math.max(0, Math.floor(body.engagement)) : undefined,
      awaitingClientReview: false,
      status: "APPROVED",
    },
  });

  return NextResponse.json({ ok: true, post: { id: updated.id, publishedAt: updated.publishedAt } });
}
