import { NextResponse } from "next/server";
import { getOnizukaEnv } from "@/lib/onizuka-env";

/** Liveness: niente DB; adatto a load balancer / uptime. */
export async function GET() {
  return NextResponse.json({
    ok: true,
    service: "onizuka",
    version: process.env.npm_package_version ?? "0.1.0",
    env: getOnizukaEnv(),
    commit: process.env.VERCEL_GIT_COMMIT_SHA?.slice(0, 7) ?? null,
  });
}
