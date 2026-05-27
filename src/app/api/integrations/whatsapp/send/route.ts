import { NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { isAdminAreaRole } from "@/lib/auth-roles";
import { sendWhatsAppTextMessage } from "@/lib/whatsapp-cloud";

/** Invio testo WhatsApp Cloud API (admin). */
export async function POST(request: Request) {
  const session = await getServerSession(authOptions);
  if (!session || !isAdminAreaRole(session.user.role)) {
    return NextResponse.json({ error: "Non autorizzato" }, { status: 401 });
  }

  const body = await request.json().catch(() => ({}));
  const toE164 = typeof body.to === "string" ? body.to.trim() : "";
  const text = typeof body.body === "string" ? body.body.trim() : "";

  if (!toE164) {
    return NextResponse.json({ error: "Campo «to» (E.164) obbligatorio." }, { status: 400 });
  }
  if (!text) {
    return NextResponse.json({ error: "Campo «body» obbligatorio." }, { status: 400 });
  }

  const result = await sendWhatsAppTextMessage({ toE164, body: text });
  if (!result.ok) {
    return NextResponse.json({ error: result.error }, { status: 502 });
  }

  return NextResponse.json({ ok: true });
}
