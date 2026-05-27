import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { getNotificationRev } from "@/lib/notification-rev";
import { countUnreadNotifications } from "@/lib/user-notifications";

export const dynamic = "force-dynamic";
export const runtime = "nodejs";

const TICK_MS = 3_000;
const MAX_TICKS = 18;

function sleep(ms: number) {
  return new Promise((r) => setTimeout(r, ms));
}

/** SSE leggero: poll DB ogni 3s, ~54s max (compatibile serverless). */
export async function GET() {
  const session = await getServerSession(authOptions);
  if (!session?.user?.id) {
    return new Response("Unauthorized", { status: 401 });
  }

  const userId = session.user.id;
  const encoder = new TextEncoder();

  const stream = new ReadableStream({
    async start(controller) {
      const send = (count: number, rev: number) => {
        controller.enqueue(encoder.encode(`data: ${JSON.stringify({ count, rev })}\n\n`));
      };

      try {
        let lastCount = await countUnreadNotifications(userId);
        let lastRev = await getNotificationRev(userId);
        send(lastCount, lastRev);

        for (let i = 0; i < MAX_TICKS; i++) {
          await sleep(TICK_MS);
          const [count, rev] = await Promise.all([
            countUnreadNotifications(userId),
            getNotificationRev(userId),
          ]);
          if (count !== lastCount || rev !== lastRev) {
            lastCount = count;
            lastRev = rev;
            send(count, rev);
          }
        }
      } catch {
        controller.enqueue(encoder.encode(`event: error\ndata: {}\n\n`));
      } finally {
        controller.close();
      }
    },
  });

  return new Response(stream, {
    headers: {
      "Content-Type": "text/event-stream; charset=utf-8",
      "Cache-Control": "no-cache, no-transform",
      Connection: "keep-alive",
    },
  });
}
