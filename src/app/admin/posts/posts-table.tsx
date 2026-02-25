"use client";

import Link from "next/link";
import { useRouter, useSearchParams } from "next/navigation";
import { Button } from "@/components/ui/button";
import { StatusBadge } from "@/components/ui/status-badge";
import type { Client, PostItem } from "@prisma/client";
import type { PostStatus, Platform } from "@prisma/client";

type PostWithMeta = PostItem & {
  client: { companyName: string; slug: string };
  _count: { media: number };
};

type Props = {
  posts: PostWithMeta[];
  clients: Client[];
  currentFilters: { clientId: string; platform: string; status: string };
};

const STATUS_LABELS: Record<PostStatus, string> = {
  PENDING: "Pending",
  APPROVED: "Approved",
  NEEDS_REVISION: "Needs revision",
};

const PLATFORM_LABELS: Record<Platform, string> = {
  FACEBOOK: "Facebook",
  INSTAGRAM: "Instagram",
  LINKEDIN: "LinkedIn",
  GBP: "Google Business",
};

export function PostsTable({ posts, clients, currentFilters }: Props) {
  const router = useRouter();
  const searchParams = useSearchParams();

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
          <label className="text-sm font-medium">Client</label>
          <select
            value={currentFilters.clientId}
            onChange={(e) => setFilter("clientId", e.target.value)}
            className="h-9 rounded-md border border-input bg-background px-2 text-sm"
          >
            <option value="">All</option>
            {clients.map((c) => (
              <option key={c.id} value={c.id}>
                {c.companyName}
              </option>
            ))}
          </select>
        </div>
        <div className="flex items-center gap-2">
          <label className="text-sm font-medium">Platform</label>
          <select
            value={currentFilters.platform}
            onChange={(e) => setFilter("platform", e.target.value)}
            className="h-9 rounded-md border border-input bg-background px-2 text-sm"
          >
            <option value="">All</option>
            {(Object.entries(PLATFORM_LABELS) as [Platform, string][]).map(([v, l]) => (
              <option key={v} value={v}>
                {l}
              </option>
            ))}
          </select>
        </div>
        <div className="flex items-center gap-2">
          <label className="text-sm font-medium">Status</label>
          <select
            value={currentFilters.status}
            onChange={(e) => setFilter("status", e.target.value)}
            className="h-9 rounded-md border border-input bg-background px-2 text-sm"
          >
            <option value="">All</option>
            {(Object.entries(STATUS_LABELS) as [PostStatus, string][]).map(([v, l]) => (
              <option key={v} value={v}>
                {l}
              </option>
            ))}
          </select>
        </div>
      </div>

      {posts.length === 0 ? (
        <p className="text-sm text-muted-foreground">No posts match the filters.</p>
      ) : (
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b text-left">
                <th className="pb-3 font-medium">Client</th>
                <th className="pb-3 font-medium">Platform</th>
                <th className="pb-3 font-medium">Status</th>
                <th className="pb-3 font-medium">Caption</th>
                <th className="pb-3 font-medium">Media</th>
                <th className="pb-3 font-medium">Created</th>
                <th className="pb-3 font-medium text-right">Actions</th>
              </tr>
            </thead>
            <tbody>
              {posts.map((p) => (
                <tr key={p.id} className="border-b last:border-0">
                  <td className="py-3">{p.client.companyName}</td>
                  <td className="py-3">{PLATFORM_LABELS[p.platform]}</td>
                  <td className="py-3">
                    <StatusBadge status={p.status} />
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
                      <Link href={`/admin/posts/${p.id}`}>View</Link>
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
