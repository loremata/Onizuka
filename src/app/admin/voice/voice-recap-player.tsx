"use client";

import { useCallback, useRef, useState } from "react";
import { Button } from "@/components/ui/button";

export function VoiceRecapPlayer({ text }: { text: string }) {
  const [supported] = useState(
    () => typeof window !== "undefined" && "speechSynthesis" in window
  );
  const [speaking, setSpeaking] = useState(false);
  const [cloudLoading, setCloudLoading] = useState(false);
  const [cloudError, setCloudError] = useState<string | null>(null);
  const [cloudProvider, setCloudProvider] = useState<string | null>(null);
  const audioRef = useRef<HTMLAudioElement | null>(null);

  const speakBrowser = useCallback(() => {
    if (!supported) return;
    window.speechSynthesis.cancel();
    const utterance = new SpeechSynthesisUtterance(text);
    utterance.lang = "it-IT";
    utterance.onend = () => setSpeaking(false);
    utterance.onerror = () => setSpeaking(false);
    setSpeaking(true);
    window.speechSynthesis.speak(utterance);
  }, [supported, text]);

  const stop = useCallback(() => {
    window.speechSynthesis.cancel();
    if (audioRef.current) {
      audioRef.current.pause();
      audioRef.current = null;
    }
    setSpeaking(false);
  }, []);

  const speakCloud = useCallback(async () => {
    setCloudLoading(true);
    setCloudError(null);
    setCloudProvider(null);
    stop();
    try {
      const res = await fetch("/api/admin/voice/tts", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ text }),
      });
      if (!res.ok) {
        const data = (await res.json().catch(() => ({}))) as { error?: string };
        setCloudError(data.error ?? "TTS non disponibile");
        return;
      }
      const provider = res.headers.get("X-Tts-Provider");
      if (provider) setCloudProvider(provider);
      const blob = await res.blob();
      const url = URL.createObjectURL(blob);
      const audio = new Audio(url);
      audioRef.current = audio;
      audio.onended = () => {
        setSpeaking(false);
        URL.revokeObjectURL(url);
      };
      audio.onerror = () => {
        setSpeaking(false);
        setCloudError("Riproduzione audio fallita.");
      };
      setSpeaking(true);
      await audio.play();
    } catch {
      setCloudError("Errore di rete TTS.");
    } finally {
      setCloudLoading(false);
    }
  }, [stop, text]);

  if (!supported) {
    return <p className="text-xs text-muted-foreground">Sintesi vocale non supportata in questo browser.</p>;
  }

  return (
    <div className="flex flex-wrap gap-2">
      <Button type="button" size="sm" variant="secondary" disabled={speaking || cloudLoading} onClick={speakBrowser}>
        Ascolta (browser)
      </Button>
      <Button type="button" size="sm" variant="outline" disabled={speaking || cloudLoading} onClick={speakCloud}>
        {cloudLoading ? "…" : "Ascolta HD (cloud)"}
      </Button>
      {speaking ? (
        <Button type="button" size="sm" variant="outline" onClick={stop}>
          Stop
        </Button>
      ) : null}
      {cloudProvider ? (
        <span className="text-xs text-muted-foreground">TTS: {cloudProvider}</span>
      ) : null}
      {cloudError ? <span className="text-xs text-destructive">{cloudError}</span> : null}
    </div>
  );
}
