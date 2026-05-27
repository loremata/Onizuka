"use client";

import { useCallback, useRef, useState, useTransition } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { platformSelectRows } from "@/lib/post-ui-labels";
import { applySquareCropToFileList } from "@/lib/image-crop-client";
import { submitClientCreative, type CreativeActionResult } from "../creative-actions";
import { UploadMediaPreview } from "./upload-media-preview";
import { UploadInteractiveCropModal } from "./upload-interactive-crop-modal";

function SubmitButton({ disabled }: { disabled?: boolean }) {
  return (
    <Button type="submit" disabled={disabled}>
      {disabled ? "Invio…" : "Invia materiale"}
    </Button>
  );
}

export function ClientCreativeForm() {
  const [state, setState] = useState<CreativeActionResult>(null);
  const [dragOver, setDragOver] = useState(false);
  const [cropSquare, setCropSquare] = useState(false);
  const [cropModalOpen, setCropModalOpen] = useState(false);
  const [cropModalFile, setCropModalFile] = useState<File | null>(null);
  const [cropTargetIndex, setCropTargetIndex] = useState(0);
  const [pending, startTransition] = useTransition();
  const fileInputRef = useRef<HTMLInputElement>(null);
  const formRef = useRef<HTMLFormElement>(null);

  const onFiles = useCallback((files: FileList | null) => {
    if (!files?.length || !fileInputRef.current) return;
    const dt = new DataTransfer();
    Array.from(files).forEach((f) => dt.items.add(f));
    fileInputRef.current.files = dt.files;
    fileInputRef.current.dispatchEvent(new Event("change", { bubbles: true }));
  }, []);

  const replaceFileAtIndex = useCallback((index: number, file: File) => {
    const input = fileInputRef.current;
    if (!input?.files) return;
    const dt = new DataTransfer();
    Array.from(input.files).forEach((f, i) => dt.items.add(i === index ? file : f));
    input.files = dt.files;
    input.dispatchEvent(new Event("change", { bubbles: true }));
  }, []);

  return (
    <form
      ref={formRef}
      className="space-y-4"
      encType="multipart/form-data"
      onSubmit={(e) => {
        e.preventDefault();
        startTransition(async () => {
          const form = formRef.current;
          if (!form) return;
          const fd = new FormData(form);
          fd.delete("media");

          const raw = fileInputRef.current?.files;
          let list = raw ? Array.from(raw) : [];
          if (cropSquare) list = await applySquareCropToFileList(list);
          list.forEach((f) => fd.append("media", f));

          const result = await submitClientCreative(state, fd);
          setState(result);
        });
      }}
    >
      <div>
        <label className="mb-1 block text-xs text-muted-foreground">Piattaforma</label>
        <select
          name="platform"
          className="h-10 w-full max-w-xs rounded-md border border-input bg-background px-3 text-sm"
          defaultValue="INSTAGRAM"
        >
          {platformSelectRows().map((p) => (
            <option key={p.value} value={p.value}>
              {p.label}
            </option>
          ))}
        </select>
      </div>
      <div>
        <label className="mb-1 block text-xs text-muted-foreground">Didascalia / note (opzionale)</label>
        <textarea
          name="captionText"
          rows={3}
          className="w-full max-w-lg rounded-md border border-input bg-background px-3 py-2 text-sm"
          placeholder="Messaggio, hashtag, indicazioni per la pubblicazione…"
        />
      </div>
      <div>
        <label className="mb-1 block text-xs text-muted-foreground">File (immagine o video)</label>
        <div
          role="button"
          tabIndex={0}
          onDragOver={(ev) => {
            ev.preventDefault();
            setDragOver(true);
          }}
          onDragLeave={() => setDragOver(false)}
          onDrop={(ev) => {
            ev.preventDefault();
            setDragOver(false);
            onFiles(ev.dataTransfer.files);
          }}
          onKeyDown={(ev) => {
            if (ev.key === "Enter" || ev.key === " ") fileInputRef.current?.click();
          }}
          className={`max-w-lg rounded-lg border-2 border-dashed p-6 text-center transition-colors ${
            dragOver ? "border-primary bg-primary/5" : "border-border"
          }`}
        >
          <p className="text-sm text-muted-foreground">
            Trascina qui uno o più file, oppure clicca per selezionare
          </p>
          <Input
            ref={fileInputRef}
            name="media"
            type="file"
            accept="image/*,video/mp4,video/webm"
            multiple
            required
            className="mt-3"
          />
          <UploadMediaPreview inputRef={fileInputRef} />
        </div>
        <p className="mt-1 text-xs text-muted-foreground">
          Il team Onizuka revisionerà il materiale prima di inviarlo in approvazione finale.
        </p>
      </div>
      <div className="flex flex-wrap items-center gap-2">
        <Button
          type="button"
          size="sm"
          variant="outline"
          onClick={() => {
            const files = fileInputRef.current?.files;
            if (!files?.length) return;
            const idx = Array.from(files).findIndex((f) => f.type.startsWith("image/"));
            if (idx < 0) return;
            setCropTargetIndex(idx);
            setCropModalFile(files[idx]);
            setCropModalOpen(true);
          }}
        >
          Ritaglio interattivo (prima immagine)
        </Button>
      </div>
      <UploadInteractiveCropModal
        file={cropModalFile}
        open={cropModalOpen}
        onClose={() => {
          setCropModalOpen(false);
          setCropModalFile(null);
        }}
        onApply={(cropped) => replaceFileAtIndex(cropTargetIndex, cropped)}
      />
      {state && "error" in state && state.error ? (
        <p className="text-sm text-destructive">{state.error}</p>
      ) : null}
      <label className="flex items-center gap-2 text-sm">
        <input type="checkbox" name="splitPosts" className="rounded border-input" />
        Un post separato per ogni file (upload multiplo)
      </label>
      <label className="flex items-center gap-2 text-sm">
        <input
          type="checkbox"
          checked={cropSquare}
          onChange={(e) => setCropSquare(e.target.checked)}
          className="rounded border-input"
        />
        Ritaglio quadrato 1:1 automatico su tutte le immagini
      </label>
      {state && "ok" in state && state.ok ? (
        <p className="text-sm text-green-600">
          {state.postCount && state.postCount > 1
            ? `${state.postCount} post inviati. Riceverai una notifica quando saranno pronti.`
            : "Materiale inviato. Riceverai una notifica quando sarà pronto per l'approvazione."}
        </p>
      ) : null}
      <SubmitButton disabled={pending} />
    </form>
  );
}
