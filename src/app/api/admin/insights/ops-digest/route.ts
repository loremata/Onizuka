import { NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { loadOpsWeeklyDigestForOwner } from "@/lib/ops-weekly-digest";

export const dynamic = "force-dynamic";

export async function GET() {
  const session = await getServerSession(authOptions);
  if (!session || session.user.role !== "ADMIN") {
    return NextResponse.json({ error: "Non autorizzato" }, { status: 401 });
  }

  const loaded = await loadOpsWeeklyDigestForOwner(session.user.id, session.user.timeZone);
  if (!loaded.ok) {
    return NextResponse.json({ error: loaded.error }, { status: 503 });
  }

  const filename = `onizuka-ops-digest-${new Date().toISOString().slice(0, 10)}.txt`;

  return new NextResponse(loaded.text, {
    status: 200,
    headers: {
      "Content-Type": "text/plain; charset=utf-8",
      "Content-Disposition": `attachment; filename="${filename}"`,
      "Cache-Control": "private, no-store",
    },
  });
}
