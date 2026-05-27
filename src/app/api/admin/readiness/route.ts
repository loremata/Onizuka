import { NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { buildProductionReadinessChecklist } from "@/lib/production-readiness";

export const dynamic = "force-dynamic";

export async function GET() {
  const session = await getServerSession(authOptions);
  if (!session || session.user.role !== "ADMIN") {
    return NextResponse.json({ error: "Non autorizzato" }, { status: 401 });
  }

  const items = buildProductionReadinessChecklist();
  const todo = items.filter((i) => i.status === "todo").length;
  const done = items.filter((i) => i.status === "done").length;

  return NextResponse.json({
    items,
    summary: { done, optional: items.filter((i) => i.status === "optional").length, todo },
    productionReady: todo === 0,
  });
}
