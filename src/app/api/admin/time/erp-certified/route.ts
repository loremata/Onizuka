import { NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { pullErpTimesheetStatus } from "@/lib/time-erp-certified";

export async function GET(request: Request) {
  const session = await getServerSession(authOptions);
  if (!session || session.user.role !== "ADMIN") {
    return NextResponse.json({ error: "Non autorizzato" }, { status: 401 });
  }

  const vendor = new URL(request.url).searchParams.get("vendor")?.trim().toLowerCase();
  if (vendor !== "zucchetti" && vendor !== "sap") {
    return NextResponse.json({ error: "vendor=zucchetti|sap" }, { status: 400 });
  }

  const status = await pullErpTimesheetStatus(vendor);
  return NextResponse.json(status);
}
