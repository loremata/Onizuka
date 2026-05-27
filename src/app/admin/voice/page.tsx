import Link from "next/link";
import { getServerSession } from "next-auth";
import { redirect } from "next/navigation";
import { authOptions } from "@/lib/auth";
import { requireAdminArea } from "@/lib/admin-session";
import { loadAdminDashboardStats } from "@/lib/admin-dashboard-stats";
import { resolveRecapDayBounds } from "@/lib/day-bounds";
import { buildVoiceRecapText } from "@/lib/voice-recap";
import { DbUnavailableBanner } from "@/components/onizuka/db-unavailable-banner";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { VoiceRecapPlayer } from "./voice-recap-player";
import { VoiceTelegramButton } from "@/components/onizuka/voice-telegram-button";
import { isTelegramConfigured } from "@/lib/telegram-bot";
import { VoiceCommandPanel } from "./voice-command-panel";
import { voiceTtsProvider, isOpenAiTtsConfigured } from "@/lib/voice-tts";
import { isElevenLabsTtsConfigured } from "@/lib/voice-tts-elevenlabs";

export default async function AdminVoicePage() {
  const session = await requireAdminArea();

  const { start, end, timeZoneLabel } = resolveRecapDayBounds({
    userTimeZone: session.user.timeZone,
  });
  const dashboard = await loadAdminDashboardStats(session.user.id, start, end);

  if (!dashboard.ok) {
    return (
      <div className="space-y-8">
        <div>
          <h1 className="text-3xl font-bold tracking-tight">Onizuka Voice</h1>
          <p className="text-muted-foreground">Recap operativo (MVP testuale).</p>
        </div>
        <DbUnavailableBanner />
      </div>
    );
  }

  const recapText = buildVoiceRecapText(dashboard.stats, timeZoneLabel);
  const ttsProvider = voiceTtsProvider();

  return (
    <div className="space-y-8">
      <div>
        <h1 className="text-3xl font-bold tracking-tight">Onizuka Voice</h1>
        <p className="text-muted-foreground">
          Recap del giorno, push-to-talk, wake word «Onizuka» e comandi rapidi.
        </p>
      </div>

      <Card className="max-w-2xl">
        <CardHeader>
          <CardTitle>TTS cloud</CardTitle>
          <CardDescription>
            ElevenLabs: {isElevenLabsTtsConfigured() ? "configurato" : "non configurato"} · OpenAI:{" "}
            {isOpenAiTtsConfigured() ? "configurato" : "non configurato"} · env{" "}
            <code className="rounded bg-muted px-1">VOICE_TTS_PROVIDER</code>
          </CardDescription>
        </CardHeader>
      </Card>

      <Card className="max-w-2xl">
        <CardHeader>
          <CardTitle>Policy autonomia (MVP)</CardTitle>
          <CardDescription>
            Basso rischio: task e navigazione. Medio: audit e sequenze (verifica in UI). Alto: invii email e
            approvazioni — bloccati da voice.
          </CardDescription>
        </CardHeader>
      </Card>

      <Card className="max-w-2xl">
        <CardHeader>
          <CardTitle>Comando vocale</CardTitle>
          <CardDescription>Push-to-talk o «Onizuka, …» · task e navigazione moduli</CardDescription>
        </CardHeader>
        <CardContent>
          <VoiceCommandPanel />
        </CardContent>
      </Card>

      <Card className="max-w-2xl">
        <CardHeader>
          <CardTitle>Recap di oggi</CardTitle>
          <CardDescription>
            Testo pronto per lettura o TTS · fuso {timeZoneLabel} · provider cloud:{" "}
            <span className="font-medium text-foreground">{ttsProvider}</span>
            {ttsProvider === "browser"
              ? " (configura OPENAI o ElevenLabs per HD)"
              : null}
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          <p className="whitespace-pre-wrap text-sm leading-relaxed">{recapText}</p>
          <VoiceRecapPlayer text={recapText} />
          <VoiceTelegramButton recapText={recapText} telegramConfigured={isTelegramConfigured()} />
          <p className="text-xs text-muted-foreground">
            API: <code className="rounded bg-muted px-1">GET /api/voice/recap</code> ·{" "}
            <Link href="/admin" className="text-primary hover:underline">
              Command Center
            </Link>
          </p>
        </CardContent>
      </Card>
    </div>
  );
}
