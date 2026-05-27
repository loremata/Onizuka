"use client";

import Link from "next/link";
import { useEffect, useRef } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import { Button } from "@/components/ui/button";
import { StatusBadge } from "@/components/ui/status-badge";
import {
  platformLabelIt,
  platformSelectRows,
  postStatusSelectRows,
} from "@/lib/post-ui-labels";
import type { Client, PostItem } from "@prisma/client";

type PostWithMeta = PostItem & {
  client: { companyName: string; slug: string };
  _count: { media: number };
};

type Props = {
  posts: PostWithMeta[];
  clients: Client[];
  currentFilters: { clientId: string; platform: string; status: string; q: string };
};

export function PostsTable({ posts, clients, currentFilters }: Props) {
  const router = useRouter();
  const searchParams = useSearchParams();
  const qRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    if (qRef.current) qRef.current.value = currentFilters.q;
  }, [currentFilters.q]);

  function setFilter(key: string, value: string) {
    const next = new URLSearchParams(searchParams.toString());
    if (value) next.set(key, value);
    else next.delete(key);
    router.push(`/admin/posts?${next.toString()}`);
  }

  return (
    <>
      <div className="flex flex-wrap items-center gap-4">
        <div className="flex items-center gap-2">
          <label className="text-sm font-medium">Cliente</label>
          <select
            value={currentFilters.clientId}
            onChange={(e) => setFilter("clientId", e.target.value)}
            className="h-9 rounded-md border border-input bg-background px-2 text-sm"
          >
            <option value="">Tutti</option>
            {clients.map((c) => (
              <option key={c.id} value={c.id}>
                {c.companyName}
              </option>
            ))}
          </select>
        </div>
        <div className="flex items-center gap-2">
          <label className="text-sm font-medium">Piattaforma</label>
          <select
            value={currentFilters.platform}
            onChange={(e) => setFilter("platform", e.target.value)}
            className="h-9 rounded-md border border-input bg-background px-2 text-sm"
          >
            <option value="">Tutti</option>
            {platformSelectRows().map(({ value, label }) => (
              <option key={value} value={value}>
                {label}
              </option>
            ))}
          </select>
        </div>
        <div className="flex items-center gap-2">
          <label className="text-sm font-medium">Stato</label>
          <select
            value={currentFilters.status}
            onChange={(e) => setFilter("status", e.target.value)}
            className="h-9 rounded-md border border-input bg-background px-2 text-sm"
          >
            <option value="">Tutti</option>
            {postStatusSelectRows().map(({ value, label }) => (
              <option key={value} value={value}>
                {label}
              </option>
            ))}
          </select>
        </div>
        <div className="flex flex-wrap items-end gap-4">
          <div className="flex min-w-[200px] flex-col gap-1">
            <label htmlFor="posts-q" className="text-sm font-medium">
              Testo
            </label>
            <input
              id="posts-q"
              ref={qRef}
              type="search"
              placeholder="Didascalia, ref. esterno, cliente…"
              className="h-9 w-full min-w-[200px] rounded-md border border-input bg-background px-2 text-sm sm:w-56"
              defaultValue={currentFilters.q}
              onKeyDown={(e) => {
                if (e.key === "Enter") {
                  e.preventDefault();
                  setFilter("q", qRef.current?.value.trim() ?? "");
                }
              }}
            />
          </div>
          <Button type="button" size="sm" variant="secondary" className="h-9" onClick={() => setFilter("q", qRef.current?.value.trim() ?? "")}>
            Cerca testo
          </Button>
          {currentFilters.q ? (
            <Button type="button" size="sm" variant="outline" className="h-9" onClick={() => setFilter("q", "")}>
              Azzera testo
            </Button>
          ) : null}
        </div>
      </div>

      {posts.length === 0 ? (
        <p className="text-sm text-muted-foreground">Nessun post corrisponde ai filtri.</p>
      ) : (
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b text-left">
                <th className="pb-3 font-medium">Cliente</th>
                <th className="pb-3 font-medium">Piattaforma</th>
                <th className="pb-3 font-medium">Stato</th>
                <th className="pb-3 font-medium">Didascalia</th>
                <th className="pb-3 font-medium">Media</th>
                <th className="pb-3 font-medium">Creato il</th>
                <th className="pb-3 font-medium text-right">Azioni</th>
              </tr>
            </thead>
            <tbody>
              {posts.map((p) => (
                <tr key={p.id} className="border-b last:border-0">
                  <td className="py-3">{p.client.companyName}</td>
                  <td className="py-3">{platformLabelIt[p.platform]}</td>
                  <td className="py-3">
                    <StatusBadge status={p.status} />
                    {!p.awaitingClientReview ? (
                      <span className="ml-2 text-[10px] text-amber-600">Cliente</span>
                    ) : null}
                  </td>
                  <td className="max-w-[200px] truncate py-3 text-muted-foreground">
                    {p.captionText || "—"}
                  </td>
                  <td className="py-3">{p._count.media}</td>
                  <td className="py-3 text-muted-foreground">
                    {new Date(p.createdAt).toLocaleDateString()}
                  </td>
                  <td className="py-3 text-right">
                    <Button asChild variant="outline" size="sm">
                      <Link href={`/admin/posts/${p.id}`}>Apri</Link>
                    </Button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </>
  );
}
