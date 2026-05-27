import { NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";

export const dynamic = "force-dynamic";

export async function GET() {
  const session = await getServerSession(authOptions);
  if (!session || session.user.role !== "ADMIN") {
    return NextResponse.json({ error: "Non autorizzato" }, { status: 401 });
  }

  const configured = Boolean(process.env.N8N_API_KEY?.trim());

  return NextResponse.json({
    configured,
    endpoints: ["/api/n8n/approved", "/api/n8n/mark-published"],
    auth: "X-API-Key o Authorization: Bearer",
    ready: configured,
  });
}
