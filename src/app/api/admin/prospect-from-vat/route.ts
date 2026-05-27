import { NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { isFullAdmin } from "@/lib/auth-roles";
import {
  extractVatFromProspectCommand,
  isProspectVatCommand,
  runProspectDigitalAiByVat,
} from "@/lib/prospect-vat-pipeline";

export async function POST(req: Request) {
  const session = await getServerSession(authOptions);
  if (!session?.user?.id || !isFullAdmin(session.user.role)) {
    return NextResponse.json({ error: "Non autorizzato" }, { status: 401 });
  }

  const body = (await req.json()) as { command?: string; vatNumber?: string };
  const command = body.command?.trim() ?? "";
  const vat =
    body.vatNumber?.trim() ||
    extractVatFromProspectCommand(command) ||
    null;

  if (!vat) {
    return NextResponse.json(
      { error: "P.IVA non trovata nel comando. Esempio: inserisci prospect digitale/AI P.IVA 12345678901" },
      { status: 400 }
    );
  }

  if (command && !isProspectVatCommand(command) && !body.vatNumber) {
    return NextResponse.json({ error: "Comando non riconosciuto come prospect da P.IVA" }, { status: 400 });
  }

  try {
    const result = await runProspectDigitalAiByVat({
      ownerUserId: session.user.id,
      vatNumber: vat,
      commandLabel: command || undefined,
    });
    return NextResponse.json({ ok: true, ...result });
  } catch (e) {
    return NextResponse.json(
      { error: e instanceof Error ? e.message : "Pipeline prospect fallita" },
      { status: 500 }
    );
  }
}
