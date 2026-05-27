import { NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { trainAndApplyDedupeModel } from "@/lib/client-dedupe-training";

export async function POST() {
  const session = await getServerSession(authOptions);
  if (!session || session.user.role !== "ADMIN") {
    return NextResponse.json({ error: "Non autorizzato" }, { status: 401 });
  }

  const result = await trainAndApplyDedupeModel({ datasetLimit: 500, backfillLimit: 500 });
  if ("error" in result) {
    return NextResponse.json(result, { status: 400 });
  }

  return NextResponse.json({
    version: result.version,
    pairs: result.pairs,
    backfilled: result.backfilled,
  });
}
