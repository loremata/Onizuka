import { NotifyDigestForm as NotifyDigestFormBase } from "@/components/notifications/notify-digest-form";
import { setNotifyDigestEmailPreference } from "./actions";

export function NotifyDigestForm({ defaultEnabled }: { defaultEnabled: boolean }) {
  return <NotifyDigestFormBase defaultEnabled={defaultEnabled} action={setNotifyDigestEmailPreference} />;
}
