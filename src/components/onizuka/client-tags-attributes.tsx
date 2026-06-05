"use client";

import { useState, useTransition } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import {
  addClientTag,
  removeClientTag,
  setClientAttribute,
  removeClientAttribute,
} from "@/app/admin/crm/database/actions";

type Props = {
  clientId: string;
  tags: string[];
  attributes: { key: string; value: string }[];
  compact?: boolean;
};

export function ClientTagsAttributes({ clientId, tags, attributes, compact = false }: Props) {
  const [pending, start] = useTransition();
  const [newTag, setNewTag] = useState("");
  const [attrKey, setAttrKey] = useState("");
  const [attrValue, setAttrValue] = useState("");

  return (
    <div className="space-y-3 text-sm">
      <div>
        <p className="mb-1 text-xs font-medium uppercase tracking-wide text-muted-foreground">Tag</p>
        <div className="flex flex-wrap items-center gap-1.5">
          {tags.length === 0 ? <span className="text-xs text-muted-foreground">—</span> : null}
          {tags.map((t) => (
            <span
              key={t}
              className="inline-flex items-center gap-1 rounded-full bg-secondary px-2 py-0.5 text-xs"
            >
              {t}
              <button
                type="button"
                aria-label={`Rimuovi ${t}`}
                className="text-muted-foreground hover:text-destructive"
                disabled={pending}
                onClick={() => start(async () => { await removeClientTag(clientId, t); })}
              >
                ×
              </button>
            </span>
          ))}
        </div>
        <div className="mt-2 flex gap-2">
          <Input
            value={newTag}
            onChange={(e) => setNewTag(e.target.value)}
            placeholder="Nuovo tag (es. TIM, no-rate)"
            className="h-8 max-w-[220px] text-xs"
            disabled={pending}
            onKeyDown={(e) => {
              if (e.key === "Enter" && newTag.trim()) {
                e.preventDefault();
                const t = newTag.trim();
                setNewTag("");
                start(async () => { await addClientTag(clientId, t); });
              }
            }}
          />
          <Button
            type="button"
            size="sm"
            variant="secondary"
            disabled={pending || !newTag.trim()}
            onClick={() => {
              const t = newTag.trim();
              setNewTag("");
              start(async () => { await addClientTag(clientId, t); });
            }}
          >
            +
          </Button>
        </div>
      </div>

      {!compact ? (
        <div>
          <p className="mb-1 text-xs font-medium uppercase tracking-wide text-muted-foreground">
            Attributi (chiave · valore)
          </p>
          <div className="space-y-1">
            {attributes.length === 0 ? (
              <span className="text-xs text-muted-foreground">—</span>
            ) : (
              attributes.map((a) => (
                <div key={a.key} className="flex items-center gap-2 text-xs">
                  <span className="font-medium">{a.key}</span>
                  <span className="text-muted-foreground">{a.value}</span>
                  <button
                    type="button"
                    aria-label={`Rimuovi ${a.key}`}
                    className="text-muted-foreground hover:text-destructive"
                    disabled={pending}
                    onClick={() => start(async () => { await removeClientAttribute(clientId, a.key); })}
                  >
                    ×
                  </button>
                </div>
              ))
            )}
          </div>
          <div className="mt-2 flex flex-wrap gap-2">
            <Input
              value={attrKey}
              onChange={(e) => setAttrKey(e.target.value)}
              placeholder="chiave (es. carrier)"
              className="h-8 max-w-[160px] text-xs"
              disabled={pending}
            />
            <Input
              value={attrValue}
              onChange={(e) => setAttrValue(e.target.value)}
              placeholder="valore (es. TIM)"
              className="h-8 max-w-[160px] text-xs"
              disabled={pending}
            />
            <Button
              type="button"
              size="sm"
              variant="secondary"
              disabled={pending || !attrKey.trim()}
              onClick={() => {
                const k = attrKey.trim();
                const v = attrValue.trim();
                setAttrKey("");
                setAttrValue("");
                start(async () => { await setClientAttribute(clientId, k, v); });
              }}
            >
              Aggiungi
            </Button>
          </div>
        </div>
      ) : null}
    </div>
  );
}
