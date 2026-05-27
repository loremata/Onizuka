import {
  createGoogleCalendarFlowEvent,
  isGoogleCalendarConnected,
} from "@/lib/google-calendar-oauth";

export type FlowCalendarSyncInput = {
  taskId: string;
  title: string;
  dueDate: Date;
  clientName?: string | null;
};

/** Crea evento su Google Calendar se l’admin ha collegato l’account (best-effort). */
export async function syncFlowTaskToGoogleCalendar(
  ownerUserId: string,
  input: FlowCalendarSyncInput
): Promise<void> {
  try {
    const connected = await isGoogleCalendarConnected(ownerUserId);
    if (!connected) return;
    await createGoogleCalendarFlowEvent(ownerUserId, input);
  } catch (e) {
    console.error("[flow-calendar-sync]", e);
  }
}
