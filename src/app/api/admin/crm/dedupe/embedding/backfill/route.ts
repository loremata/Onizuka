import { NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { backfillClientDedupeEmbeddings } from "@/lib/client-dedupe-embedding-persist";

export async function POST(request: Request) {
  const session = await getServerSession(authOptions);
  if (!session || session.user.role !== "ADMIN") {
    return NextResponse.json({ error: "Non autorizzato" }, { status: 401 });
  }

  let limit = 50;
  try {
    const body = (await request.json()) as { limit?: number };
    if (typeof body.limit === "number" && body.limit > 0 && body.limit <= 200) {
      limit = body.limit;
    }
  } catch {
    /* default */
  }

  const result = await backfillClientDedupeEmbeddings(limit);
  return NextResponse.json(result);
}
