import { NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { runAskWithMemory } from "@/lib/ask-with-memory";

export const runtime = "nodejs";

export async function POST(request: Request) {
  const session = await getServerSession(authOptions);
  if (!session || session.user.role !== "ADMIN") {
    return NextResponse.json({ error: "Non autorizzato" }, { status: 401 });
  }

  const body = await request.json().catch(() => ({}));
  const q = typeof body.q === "string" ? body.q.trim() : "";
  if (!q || q.length > 500) {
    return NextResponse.json({ error: "Query non valida (max 500 caratteri)." }, { status: 400 });
  }

  const result = await runAskWithMemory(session.user.id, q);
  return NextResponse.json(result);
}
