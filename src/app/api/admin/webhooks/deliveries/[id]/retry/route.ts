import { NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { retryWebhookDelivery } from "@/lib/webhook-delivery-queue";

export const runtime = "nodejs";

export async function POST(
  _request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  const session = await getServerSession(authOptions);
  if (!session || session.user.role !== "ADMIN") {
    return NextResponse.json({ error: "Non autorizzato" }, { status: 401 });
  }

  const { id } = await params;
  const result = await retryWebhookDelivery(id, session.user.id);
  if (result.ok) {
    return NextResponse.json({ ok: true });
  }
  return NextResponse.json(
    { error: result.error, httpStatus: result.httpStatus },
    { status: 422 }
  );
}
