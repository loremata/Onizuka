import { NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { isAdminAreaRole } from "@/lib/auth-roles";
import { voiceTtsProvider } from "@/lib/voice-tts";
import { synthesizeCloudTts } from "@/lib/voice-tts-synthesize";

export const dynamic = "force-dynamic";

export async function POST(req: Request) {
  const session = await getServerSession(authOptions);
  if (!session || !isAdminAreaRole(session.user.role)) {
    return NextResponse.json({ error: "Non autorizzato" }, { status: 401 });
  }

  if (voiceTtsProvider() === "browser") {
    return NextResponse.json(
      { error: "TTS cloud non configurato (OPENAI_API_KEY o ELEVENLABS_API_KEY)." },
      { status: 503 }
    );
  }

  let text = "";
  try {
    const body = (await req.json()) as { text?: string };
    text = body.text?.trim() ?? "";
  } catch {
    return NextResponse.json({ error: "Body JSON non valido." }, { status: 400 });
  }

  const result = await synthesizeCloudTts(text);
  if (!result.ok) {
    return NextResponse.json({ error: result.error }, { status: 502 });
  }

  return new NextResponse(new Uint8Array(result.buffer), {
    status: 200,
    headers: {
      "Content-Type": "audio/mpeg",
      "Cache-Control": "private, max-age=3600",
      "X-Tts-Cache": result.fromCache ? "hit" : "miss",
      "X-Tts-Provider": result.provider,
    },
  });
}
