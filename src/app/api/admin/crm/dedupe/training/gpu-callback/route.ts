import { NextRequest, NextResponse } from "next/server";
import { completeDedupeGpuTrainingJob } from "@/lib/dedupe-training-gpu";

export async function POST(request: NextRequest) {
  let body: { jobId?: string; weightsJson?: string };
  try {
    body = (await request.json()) as typeof body;
  } catch {
    return NextResponse.json({ error: "JSON non valido." }, { status: 400 });
  }

  if (!body.jobId?.trim() || !body.weightsJson?.trim()) {
    return NextResponse.json({ error: "jobId e weightsJson obbligatori." }, { status: 400 });
  }

  const secret = request.headers.get("x-dedupe-gpu-secret") ?? undefined;
  const result = await completeDedupeGpuTrainingJob({
    jobId: body.jobId,
    weightsJson: body.weightsJson,
    secret,
  });

  if ("error" in result) {
    return NextResponse.json(result, { status: 400 });
  }

  return NextResponse.json(result);
}
