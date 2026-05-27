import { NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { exportDedupeTrainingDataset } from "@/lib/client-dedupe-training";

export async function GET() {
  const session = await getServerSession(authOptions);
  if (!session || session.user.role !== "ADMIN") {
    return NextResponse.json({ error: "Non autorizzato" }, { status: 401 });
  }

  const { records } = await exportDedupeTrainingDataset(500);
  const jsonl = records.map((r) => JSON.stringify(r)).join("\n");
  return new NextResponse(jsonl, {
    headers: {
      "Content-Type": "application/x-ndjson",
      "Content-Disposition": `attachment; filename="dedupe-training-${new Date().toISOString().slice(0, 10)}.jsonl"`,
    },
  });
}
