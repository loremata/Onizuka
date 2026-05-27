import { NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { buildIcsCalendar, flowTaskToIcsEvent } from "@/lib/ics-export";
import { resolveRecapDayBounds } from "@/lib/day-bounds";

export async function GET() {
  const session = await getServerSession(authOptions);
  if (!session || session.user.role !== "ADMIN") {
    return NextResponse.json({ error: "Non autorizzato" }, { status: 401 });
  }

  const { end: dayEnd } = resolveRecapDayBounds({ userTimeZone: session.user.timeZone });
  const horizon = new Date(dayEnd);
  horizon.setDate(horizon.getDate() + 14);

  const openStatuses = ["TODO", "IN_PROGRESS", "WAITING"] as const;

  const tasks = await prisma.flowTask.findMany({
    where: {
      ownerUserId: session.user.id,
      status: { in: [...openStatuses] },
      dueDate: { lte: horizon, not: null },
    },
    orderBy: { dueDate: "asc" },
    take: 200,
    include: { client: { select: { companyName: true } } },
  });

  const events = tasks
    .filter((t): t is typeof t & { dueDate: Date } => t.dueDate != null)
    .map((t) =>
      flowTaskToIcsEvent({
        id: t.id,
        title: t.title,
        dueDate: t.dueDate,
        description: t.description,
        clientName: t.client?.companyName ?? null,
      })
    );

  const ics = buildIcsCalendar(events, "Onizuka Flow");
  return new NextResponse(ics, {
    headers: {
      "Content-Type": "text/calendar; charset=utf-8",
      "Content-Disposition": 'attachment; filename="onizuka-flow.ics"',
    },
  });
}
