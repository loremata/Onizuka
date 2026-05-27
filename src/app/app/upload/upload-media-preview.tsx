"use client";

import { useEffect, useState, type RefObject } from "react";

type PreviewItem = {
  id: string;
  name: string;
  url: string;
  isImage: boolean;
};

export function UploadMediaPreview({ inputRef }: { inputRef: RefObject<HTMLInputElement | null> }) {
  const [items, setItems] = useState<PreviewItem[]>([]);

  useEffect(() => {
    const input = inputRef.current;
    if (!input) return;

    function refresh() {
      if (!input) return;
      const files = input.files;
      if (!files?.length) {
        setItems([]);
        return;
      }
      const next: PreviewItem[] = Array.from(files).map((file, i) => ({
        id: `${file.name}-${i}`,
        name: file.name,
        url: file.type.startsWith("image/") ? URL.createObjectURL(file) : "",
        isImage: file.type.startsWith("image/"),
      }));
      setItems(next);
    }

    input.addEventListener("change", refresh);
    return () => input.removeEventListener("change", refresh);
  }, [inputRef]);

  useEffect(() => {
    return () => {
      items.forEach((item) => {
        if (item.url) URL.revokeObjectURL(item.url);
      });
    };
  }, [items]);

  if (items.length === 0) return null;

  return (
    <div className="mt-3 grid max-w-lg grid-cols-3 gap-2 sm:grid-cols-4">
      {items.map((item) => (
        <div
          key={item.id}
          className="overflow-hidden rounded-md border border-border bg-muted/30 text-center"
        >
          {item.isImage && item.url ? (
            // eslint-disable-next-line @next/next/no-img-element
            <img src={item.url} alt={item.name} className="aspect-square h-20 w-full object-cover" />
          ) : (
            <div className="flex aspect-square h-20 items-center justify-center text-xs text-muted-foreground">
              Video
            </div>
          )}
          <p className="truncate px-1 py-0.5 text-[10px] text-muted-foreground">{item.name}</p>
        </div>
      ))}
    </div>
  );
}
