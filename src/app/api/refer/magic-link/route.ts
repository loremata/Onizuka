import { NextResponse } from "next/server";
import { createAndEmailReferrerMagicLink } from "@/lib/referrer-magic-link";

export async function POST(request: Request) {
  const body = await request.json().catch(() => ({}));
  const token = typeof body.token === "string" ? body.token.trim() : "";
  const email = typeof body.email === "string" ? body.email.trim() : "";

  if (!token || token.length < 16) {
    return NextResponse.json({ error: "Token portale non valido." }, { status: 400 });
  }
  if (!email) {
    return NextResponse.json({ error: "Email obbligatoria." }, { status: 400 });
  }

  const result = await createAndEmailReferrerMagicLink({ submissionToken: token, email });
  if ("error" in result) {
    return NextResponse.json({ error: result.error }, { status: 400 });
  }

  return NextResponse.json({
    ok: true,
    message: "Se l'email è registrata, riceverai un link di accesso entro pochi minuti.",
  });
}
