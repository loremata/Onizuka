import { NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { isAdminAreaRole } from "@/lib/auth-roles";
import { sendWhatsAppTemplateMessage } from "@/lib/whatsapp-cloud";

export async function POST(request: Request) {
  const session = await getServerSession(authOptions);
  if (!session || !isAdminAreaRole(session.user.role)) {
    return NextResponse.json({ error: "Non autorizzato" }, { status: 401 });
  }

  const body = await request.json().catch(() => ({}));
  const to = typeof body.to === "string" ? body.to.trim() : "";
  const templateName = typeof body.templateName === "string" ? body.templateName.trim() : "";
  const languageCode = typeof body.languageCode === "string" ? body.languageCode : "it";
  const bodyParameters = Array.isArray(body.bodyParameters)
    ? body.bodyParameters.map((v: unknown) => String(v))
    : undefined;

  if (!to || !templateName) {
    return NextResponse.json({ error: "Campi «to» e «templateName» obbligatori." }, { status: 400 });
  }

  const result = await sendWhatsAppTemplateMessage({ toE164: to, templateName, languageCode, bodyParameters });
  if (!result.ok) {
    return NextResponse.json({ error: result.error }, { status: 502 });
  }

  return NextResponse.json({ ok: true });
}
