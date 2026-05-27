import { NextResponse } from "next/server";
import { ApiErrorCode } from "@/lib/api-json-errors";
import { getDeployCapabilities } from "@/lib/deploy-capabilities";
import { prisma } from "@/lib/prisma";

export const dynamic = "force-dynamic";

/** Readiness: verifica connessione al database. */
export async function GET() {
  try {
    await prisma.$queryRaw`SELECT 1`;
    return NextResponse.json({
      ok: true,
      status: "ready",
      database: "ok",
      capabilities: getDeployCapabilities(),
    });
  } catch (e) {
    const message = e instanceof Error ? e.message : String(e);
    return NextResponse.json(
      {
        ok: false,
        status: "not_ready",
        database: "error",
        code: ApiErrorCode.DATABASE_NOT_READY,
        error: "Database non disponibile",
        detail: message,
      },
      { status: 503 }
    );
  }
}
