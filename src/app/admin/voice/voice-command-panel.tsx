"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { useFormState } from "react-dom";
import { Button } from "@/components/ui/button";
import { hasOnizukaWakeWord, stripOnizukaWakePrefix } from "@/lib/voice-wake";
import { executeVoiceCommand, type VoiceActionResult } from "./actions";

type SpeechRecognitionCtor = new () => {
  lang: string;
  continuous: boolean;
  interimResults: boolean;
  onresult: ((ev: { resultIndex: number; results: Iterable<{ isFinal: boolean; 0?: { transcript: string } }> }) => void) | null;
  onerror: (() => void) | null;
  onend: (() => void) | null;
  start: () => void;
  stop: () => void;
};

function getSpeechRecognition(): SpeechRecognitionCtor | null {
  if (typeof window === "undefined") return null;
  const w = window as Window & {
    SpeechRecognition?: SpeechRecognitionCtor;
    webkitSpeechRecognition?: SpeechRecognitionCtor;
  };
  return w.SpeechRecognition ?? w.webkitSpeechRecognition ?? null;
}

export function VoiceCommandPanel() {
  const [listening, setListening] = useState(false);
  const [wakeMode, setWakeMode] = useState(false);
  const [transcript, setTranscript] = useState("");
  const [localError, setLocalError] = useState<string | null>(null);
  const recognitionRef = useRef<InstanceType<SpeechRecognitionCtor> | null>(null);
  const formRef = useRef<HTMLFormElement>(null);

  const [state, formAction] = useFormState(executeVoiceCommand, null as VoiceActionResult);

  const submitTranscript = useCallback((raw: string) => {
    const cleaned = stripOnizukaWakePrefix(raw);
    if (cleaned.length < 3) return;
    setTranscript(cleaned);
    requestAnimationFrame(() => formRef.current?.requestSubmit());
  }, []);

  const startListening = useCallback(() => {
    const Ctor = getSpeechRecognition();
    if (!Ctor) {
      setLocalError("Riconoscimento vocale non supportato in questo browser (usa Chrome/Edge).");
      return;
    }

    setLocalError(null);
    const rec = new Ctor();
    rec.lang = "it-IT";
    rec.continuous = wakeMode;
    rec.interimResults = wakeMode;
    recognitionRef.current = rec;

    rec.onresult = (ev) => {
      let text = "";
      const results = Array.from(ev.results);
      for (let i = ev.resultIndex; i < results.length; i++) {
        if (results[i].isFinal) {
          text += results[i][0]?.transcript ?? "";
        }
      }
      const trimmed = text.trim();
      if (!trimmed) return;

      if (wakeMode) {
        if (hasOnizukaWakeWord(trimmed)) {
          recognitionRef.current?.stop();
          setListening(false);
          submitTranscript(trimmed);
        }
      } else {
        setTranscript(trimmed);
      }
    };
    rec.onerror = () => setLocalError("Errore microfono o permesso negato.");
    rec.onend = () => setListening(false);

    setListening(true);
    rec.start();
  }, [wakeMode, submitTranscript]);

  const stopListening = useCallback(() => {
    recognitionRef.current?.stop();
    setListening(false);
  }, []);

  useEffect(() => {
    return () => recognitionRef.current?.stop();
  }, []);

  const speakMessage = useCallback((text: string) => {
    if (typeof window === "undefined" || !window.speechSynthesis) return;
    window.speechSynthesis.cancel();
    const u = new SpeechSynthesisUtterance(text);
    u.lang = "it-IT";
    u.rate = 1;
    window.speechSynthesis.speak(u);
  }, []);

  return (
    <div className="space-y-4">
      <p className="text-sm text-muted-foreground">
        Push-to-talk o modalità <strong>Onizuka</strong>: in ascolto continuo, di&apos; «Onizuka, ricordami di…» per
        eseguire subito. Comandi: recap, audit, finance, reach, flow in ritardo.
      </p>
      <div className="flex flex-wrap gap-2">
        <Button
          type="button"
          variant={wakeMode ? "default" : "outline"}
          size="sm"
          onClick={() => setWakeMode((v) => !v)}
          disabled={listening}
        >
          {wakeMode ? "Modalità Onizuka attiva" : "Attiva modalità Onizuka"}
        </Button>
        <Button
          type="button"
          variant={listening ? "destructive" : "secondary"}
          onClick={listening ? stopListening : startListening}
        >
          {listening ? "Stop" : wakeMode ? "Ascolta…" : "Parla"}
        </Button>
      </div>
      {transcript ? (
        <form ref={formRef} action={formAction} className="flex flex-col gap-2 sm:flex-row sm:items-center">
          <input type="hidden" name="transcript" value={transcript} />
          <p className="flex-1 rounded-md border border-border/60 bg-muted/30 px-3 py-2 text-sm italic">{transcript}</p>
          {!wakeMode ? (
            <Button type="submit" size="sm">
              Esegui
            </Button>
          ) : null}
        </form>
      ) : null}
      {localError ? <p className="text-sm text-destructive">{localError}</p> : null}
      {state && "error" in state ? <p className="text-sm text-destructive">{state.error}</p> : null}
      {state && "ok" in state && state.ok ? (
        <div className="flex flex-wrap items-center gap-2">
          <p className="text-sm text-green-600 dark:text-green-400">{state.message}</p>
          <Button type="button" size="sm" variant="outline" onClick={() => speakMessage(state.message)}>
            Ascolta (TTS)
          </Button>
        </div>
      ) : null}
    </div>
  );
}
