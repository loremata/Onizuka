"use server";

import { requireFullAdmin } from "@/lib/admin-session";
import { sendOpsWeeklyDigestEmail } from "@/lib/ops-weekly-digest";

export async function sendOpsWeeklyDigestAction(): Promise<
  { ok: true } | { ok: false; error: string }
> {
  const session = await requireFullAdmin();
  if (!session.user.email) {
    return { ok: false, error: "Email admin non disponibile." };
  }

  return sendOpsWeeklyDigestEmail(session.user.id, session.user.timeZone, session.user.email);
}
