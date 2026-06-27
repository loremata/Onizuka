"use client";

import { useRouter, useSearchParams } from "next/navigation";
import { platformSelectRows, postStatusSelectRows } from "@/lib/post-ui-labels";
import { Select } from "@/components/ui/select";

const PLATFORMS = [{ value: "", label: "Tutte le piattaforme" }, ...platformSelectRows()];
const STATUSES = [{ value: "", label: "Tutti gli stati" }, ...postStatusSelectRows()];

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
        <label className="text-sm font-medium">Piattaforma</label>
        <Select
          value={currentPlatform}
          onChange={(e) => setFilter("platform", e.target.value)}
          className="h-9 rounded-md border border-input bg-background px-2 text-sm"
        >
          {PLATFORMS.map((p) => (
            <option key={p.value || "all"} value={p.value}>
              {p.label}
            </option>
          ))}
        </Select>
      </div>
      <div className="flex items-center gap-2">
        <label className="text-sm font-medium">Stato</label>
        <Select
          value={currentStatus}
          onChange={(e) => setFilter("status", e.target.value)}
          className="h-9 rounded-md border border-input bg-background px-2 text-sm"
        >
          {STATUSES.map((s) => (
            <option key={s.value || "all"} value={s.value}>
              {s.label}
            </option>
          ))}
        </Select>
      </div>
    </div>
  );
}
