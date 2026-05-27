import { NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { isFullAdmin } from "@/lib/auth-roles";
import { deleteGbpBusinessConnection } from "@/lib/gbp-business-oauth";

export async function POST() {
  const session = await getServerSession(authOptions);
  if (!session || !isFullAdmin(session.user.role)) {
    return NextResponse.json({ error: "Non autorizzato" }, { status: 401 });
  }

  await deleteGbpBusinessConnection(session.user.id);
  return NextResponse.json({ ok: true });
}
