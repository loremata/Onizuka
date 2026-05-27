"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { Button } from "@/components/ui/button";
import { cropImageWithTransform, type CropTransform } from "@/lib/image-crop-interactive";

export function UploadInteractiveCropModal({
  file,
  open,
  onClose,
  onApply,
}: {
  file: File | null;
  open: boolean;
  onClose: () => void;
  onApply: (cropped: File) => void;
}) {
  const [previewUrl, setPreviewUrl] = useState<string | null>(null);
  const [zoom, setZoom] = useState(1.1);
  const [offset, setOffset] = useState({ x: 0, y: 0 });
  const [dragging, setDragging] = useState(false);
  const dragStart = useRef({ x: 0, y: 0, ox: 0, oy: 0 });
  const [pending, setPending] = useState(false);

  useEffect(() => {
    if (!file || !open) {
      setPreviewUrl(null);
      return;
    }
    const url = URL.createObjectURL(file);
    setPreviewUrl(url);
    setZoom(1.1);
    setOffset({ x: 0, y: 0 });
    return () => URL.revokeObjectURL(url);
  }, [file, open]);

  const onPointerDown = useCallback(
    (e: React.PointerEvent) => {
      setDragging(true);
      dragStart.current = { x: e.clientX, y: e.clientY, ox: offset.x, oy: offset.y };
      (e.target as HTMLElement).setPointerCapture(e.pointerId);
    },
    [offset]
  );

  const onPointerMove = useCallback(
    (e: React.PointerEvent) => {
      if (!dragging) return;
      const dx = e.clientX - dragStart.current.x;
      const dy = e.clientY - dragStart.current.y;
      setOffset({
        x: dragStart.current.ox + dx,
        y: dragStart.current.oy + dy,
      });
    },
    [dragging]
  );

  const onPointerUp = useCallback(() => setDragging(false), []);

  if (!open || !file || !previewUrl) return null;

  const transform: CropTransform = { zoom, offsetX: offset.x, offsetY: offset.y };

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 p-4"
      role="dialog"
      aria-modal="true"
    >
      <div className="max-h-[90vh] w-full max-w-md overflow-auto rounded-lg border bg-background p-4 shadow-lg">
        <h3 className="text-sm font-semibold">Ritaglio interattivo · {file.name}</h3>
        <p className="mt-1 text-xs text-muted-foreground">Trascina per spostare · regola lo zoom</p>
        <div
          className="relative mx-auto mt-3 aspect-square w-full max-w-xs cursor-grab overflow-hidden rounded-md border bg-muted active:cursor-grabbing"
          onPointerDown={onPointerDown}
          onPointerMove={onPointerMove}
          onPointerUp={onPointerUp}
          onPointerLeave={onPointerUp}
        >
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img
            src={previewUrl}
            alt="Anteprima ritaglio"
            className="pointer-events-none h-full w-full object-cover"
            style={{
              transform: `scale(${zoom}) translate(${offset.x / zoom}px, ${offset.y / zoom}px)`,
            }}
          />
        </div>
        <label className="mt-3 block text-xs">
          Zoom {zoom.toFixed(2)}
          <input
            type="range"
            min={1}
            max={3}
            step={0.05}
            value={zoom}
            onChange={(e) => setZoom(Number(e.target.value))}
            className="mt-1 w-full"
          />
        </label>
        <div className="mt-4 flex flex-wrap gap-2">
          <Button
            type="button"
            size="sm"
            disabled={pending}
            onClick={async () => {
              setPending(true);
              try {
                const cropped = await cropImageWithTransform(file, transform);
                onApply(cropped);
                onClose();
              } finally {
                setPending(false);
              }
            }}
          >
            {pending ? "…" : "Applica ritaglio"}
          </Button>
          <Button type="button" size="sm" variant="outline" onClick={onClose}>
            Annulla
          </Button>
        </div>
      </div>
    </div>
  );
}
