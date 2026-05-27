import { NextResponse } from "next/server";
import type { Session } from "next-auth";
import { requireAdminApiSession } from "@/lib/api-admin-auth";
import { loadActionInbox } from "@/lib/action-inbox";

export async function GET() {
  const session = await requireAdminApiSession("/admin/inbox");
  if (session instanceof NextResponse) return session;

  const items = await loadActionInbox((session as Session).user.id);
  return NextResponse.json({ ok: true, items });
}
