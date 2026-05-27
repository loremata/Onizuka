import { NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { importDedupeModelWeights } from "@/lib/client-dedupe-training";

export async function POST(request: Request) {
  const session = await getServerSession(authOptions);
  if (!session || session.user.role !== "ADMIN") {
    return NextResponse.json({ error: "Non autorizzato" }, { status: 401 });
  }

  let body: { weightsJson?: string; notes?: string };
  try {
    body = (await request.json()) as typeof body;
  } catch {
    return NextResponse.json({ error: "JSON non valido." }, { status: 400 });
  }

  if (!body.weightsJson?.trim()) {
    return NextResponse.json({ error: "weightsJson obbligatorio." }, { status: 400 });
  }

  const result = await importDedupeModelWeights({
    weightsJson: body.weightsJson,
    notes: body.notes,
  });

  if ("error" in result) {
    return NextResponse.json(result, { status: 400 });
  }

  return NextResponse.json(result);
}
