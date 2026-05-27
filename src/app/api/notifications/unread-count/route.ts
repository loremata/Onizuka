import { NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { getNotificationRev } from "@/lib/notification-rev";
import { countUnreadNotifications } from "@/lib/user-notifications";

export const dynamic = "force-dynamic";

export async function GET() {
  const session = await getServerSession(authOptions);
  if (!session?.user?.id) {
    return NextResponse.json({ error: "Non autorizzato" }, { status: 401 });
  }

  const [count, rev] = await Promise.all([
    countUnreadNotifications(session.user.id),
    getNotificationRev(session.user.id),
  ]);
  return NextResponse.json({ count, rev });
}
