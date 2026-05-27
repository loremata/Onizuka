"use client";

import Link from "next/link";
import { usePathname, useSearchParams } from "next/navigation";

export function GbpAssetPicker({
  clientId,
  assets,
  selectedAssetId,
}: {
  clientId: string;
  assets: { id: string; name: string }[];
  selectedAssetId: string;
}) {
  const pathname = usePathname();
  const searchParams = useSearchParams();

  if (assets.length <= 1) return null;

  function hrefFor(assetId: string) {
    const params = new URLSearchParams(searchParams.toString());
    params.set("gbpAsset", assetId);
    return `${pathname}?${params.toString()}`;
  }

  return (
    <div className="flex flex-wrap gap-2 pb-2">
      {assets.map((a) => (
        <Link
          key={a.id}
          href={hrefFor(a.id)}
          className={`rounded-md border px-2 py-1 text-xs transition-colors ${
            a.id === selectedAssetId
              ? "border-primary bg-primary/10 text-primary"
              : "border-border text-muted-foreground hover:text-foreground"
          }`}
        >
          {a.name}
        </Link>
      ))}
    </div>
  );
}
