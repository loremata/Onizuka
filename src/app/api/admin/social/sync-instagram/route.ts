import { NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { syncInstagramMediaComments } from "@/lib/social-instagram-sync";

export async function POST() {
  const session = await getServerSession(authOptions);
  if (!session || session.user.role !== "ADMIN") {
    return NextResponse.json({ error: "Non autorizzato" }, { status: 401 });
  }
  const result = await syncInstagramMediaComments(25);
  if (result.error) return NextResponse.json(result, { status: 502 });
  return NextResponse.json(result);
}
