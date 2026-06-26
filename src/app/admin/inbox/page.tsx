import { redirect } from "next/navigation";

// Evita il prerender statico: il redirect deve avvenire a runtime.
export const dynamic = "force-dynamic";

/** Action Inbox unificata nel Command Center (v2-3): /admin/inbox → /admin. */
export default async function ActionInboxRedirect() {
  redirect("/admin");
}
