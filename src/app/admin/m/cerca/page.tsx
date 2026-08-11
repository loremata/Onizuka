import { requireFullAdmin } from "@/lib/admin-session";
import { MobileClientSearch } from "./client-search";

export const dynamic = "force-dynamic";

/** requireFullAdmin come l'azione di ricerca che sta sotto (searchClientsForCounter). */
export default async function MobileCercaPage() {
  await requireFullAdmin();

  return (
    <div className="space-y-4">
      <h1 className="text-xl font-semibold tracking-tight">Cerca</h1>
      <MobileClientSearch />
    </div>
  );
}
