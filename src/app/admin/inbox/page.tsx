import { redirect } from "next/navigation";

/** Action Inbox unificata nel Command Center (v2-3): /admin/inbox → /admin. */
export default async function ActionInboxRedirect() {
  redirect("/admin");
}
