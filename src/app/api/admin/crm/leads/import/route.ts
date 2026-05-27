import { NextRequest, NextResponse } from "next/server";
import type { Session } from "next-auth";
import { requireAdminApiSession } from "@/lib/api-admin-auth";
import { importLeadsFromCsv } from "@/lib/lead-csv-import";

export async function POST(request: NextRequest) {
  const session = await requireAdminApiSession("/admin/crm/leads");
  if (session instanceof NextResponse) return session;

  const form = await request.formData();
  const file = form.get("file");
  if (!(file instanceof File)) {
    return NextResponse.json({ error: "File CSV richiesto." }, { status: 400 });
  }
  const text = await file.text();
  const result = await importLeadsFromCsv((session as Session).user.id, text);
  return NextResponse.json({ ok: true, ...result });
}
