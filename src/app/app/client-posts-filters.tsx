"use client";

import { useRouter, useSearchParams } from "next/navigation";

const PLATFORMS = [
  { value: "", label: "All platforms" },
  { value: "FACEBOOK", label: "Facebook" },
  { value: "INSTAGRAM", label: "Instagram" },
  { value: "LINKEDIN", label: "LinkedIn" },
  { value: "GBP", label: "Google Business" },
];

const STATUSES = [
  { value: "", label: "All statuses" },
  { value: "PENDING", label: "Pending" },
  { value: "APPROVED", label: "Approved" },
  { value: "NEEDS_REVISION", label: "Needs revision" },
];

type Props = { currentPlatform: string; currentStatus: string };

export function ClientPostsFilters({ currentPlatform, currentStatus }: Props) {
  const router = useRouter();
  const searchParams = useSearchParams();

  function setFilter(key: string, value: string) {
    const next = new URLSearchParams(searchParams.toString());
    if (value) next.set(key, value);
    else next.delete(key);
    router.push(`/app?${next.toString()}`);
  }

  return (
    <div className="flex flex-wrap items-center gap-4">
      <div className="flex items-center gap-2">
        <label className="text-sm font-medium">Platform</label>
        <select
          value={currentPlatform}
          onChange={(e) => setFilter("platform", e.target.value)}
          className="h-9 rounded-md border border-input bg-background px-2 text-sm"
        >
          {PLATFORMS.map((p) => (
            <option key={p.value || "all"} value={p.value}>
              {p.label}
            </option>
          ))}
        </select>
      </div>
      <div className="flex items-center gap-2">
        <label className="text-sm font-medium">Status</label>
        <select
          value={currentStatus}
          onChange={(e) => setFilter("status", e.target.value)}
          className="h-9 rounded-md border border-input bg-background px-2 text-sm"
        >
          {STATUSES.map((s) => (
            <option key={s.value || "all"} value={s.value}>
              {s.label}
            </option>
          ))}
        </select>
      </div>
    </div>
  );
}
