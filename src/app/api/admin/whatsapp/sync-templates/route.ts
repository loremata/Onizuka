import { NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { syncWhatsAppTemplatesFromMeta } from "@/lib/whatsapp-sync-templates";

export async function POST() {
  const session = await getServerSession(authOptions);
  if (!session || session.user.role !== "ADMIN") {
    return NextResponse.json({ error: "Non autorizzato" }, { status: 401 });
  }
  const result = await syncWhatsAppTemplatesFromMeta();
  if (result.error) return NextResponse.json(result, { status: 502 });
  return NextResponse.json(result);
}
