// Ritorna l'elenco comuni di una provincia (per popolare la seconda tendina).
// Tenuto server-side per non spedire al browser l'intero dataset (~420KB).
import { NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { PROVINCE_ITALIA } from "@/lib/scraping/comuni-italia";

export async function GET(request: Request) {
  const session = await getServerSession(authOptions);
  if (!session || session.user.role !== "ADMIN") {
    return NextResponse.json({ error: "Non autorizzato" }, { status: 401 });
  }
  const provincia = new URL(request.url).searchParams.get("provincia")?.trim();
  const prov = PROVINCE_ITALIA.find((p) => p.nome === provincia);
  if (!prov) return NextResponse.json({ comuni: [] });
  return NextResponse.json({
    comuni: prov.comuni.map((c) => ({ nome: c.nome, slug: c.slug })),
  });
}
