import { NextResponse } from "next/server";
import type { Session } from "next-auth";
import { requireAdminApiSession } from "@/lib/api-admin-auth";
import { getLeadPipelineBottlenecks } from "@/lib/lead-pipeline-bottleneck";

export async function GET() {
  const session = await requireAdminApiSession("/admin/crm/leads");
  if (session instanceof NextResponse) return session;
  const items = await getLeadPipelineBottlenecks((session as Session).user.id);
  return NextResponse.json({ ok: true, items });
}
