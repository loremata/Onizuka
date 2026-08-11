import { redirect } from "next/navigation";

/** La shell mobile non ha una home a se': si entra dal gesto piu' frequente. */
export default function MobileHomePage() {
  redirect("/admin/m/registra");
}
