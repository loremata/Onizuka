"use client";

import { useEffect } from "react";
import { useRouter } from "next/navigation";
import { markClientTicketsRead } from "./actions";

export function TicketsMarkRead() {
  const router = useRouter();
  useEffect(() => {
    void markClientTicketsRead().then(() => router.refresh());
  }, [router]);
  return null;
}
