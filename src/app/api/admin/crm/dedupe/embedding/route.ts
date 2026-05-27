import { NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { isEmbeddingConfigured } from "@/lib/llm-client";
import { findEmbeddingDuplicatePairs } from "@/lib/client-dedupe-embedding";

export async function GET() {
  const session = await getServerSession(authOptions);
  if (!session || session.user.role !== "ADMIN") {
    return NextResponse.json({ error: "Non autorizzato" }, { status: 401 });
  }

  if (!isEmbeddingConfigured()) {
    return NextResponse.json({ pairs: [], configured: false });
  }

  const pairs = await findEmbeddingDuplicatePairs(30);
  return NextResponse.json({ pairs, configured: true });
}
