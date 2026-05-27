import { NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { findAccountsWithDefaultSeedPasswords } from "@/lib/seed-password-check";

export const dynamic = "force-dynamic";

export async function GET() {
  const session = await getServerSession(authOptions);
  if (!session || session.user.role !== "ADMIN") {
    return NextResponse.json({ error: "Non autorizzato" }, { status: 401 });
  }

  const weakEmails = await findAccountsWithDefaultSeedPasswords();
  return NextResponse.json({
    ok: weakEmails.length === 0,
    weakEmails,
    message:
      weakEmails.length === 0
        ? "Nessun account seed con password predefinita."
        : "Cambia le password degli account demo prima del go-live.",
  });
}
