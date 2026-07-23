import { redirect } from "next/navigation";

/**
 * L'analisi vive ora sul cruscotto: filtri, torte e spaccato sono lì, dove
 * servono davvero. Questa rotta resta solo per non rompere i link salvati.
 */
export default function AnalisiRedirect({
  searchParams,
}: {
  searchParams: { mese?: string; brand?: string; cat?: string };
}) {
  const p = new URLSearchParams();
  if (searchParams.mese) p.set("mese", searchParams.mese);
  if (searchParams.brand) p.set("brand", searchParams.brand);
  if (searchParams.cat) p.set("cat", searchParams.cat);
  const q = p.toString();
  redirect("/admin/inserimenti" + (q ? `?${q}` : "") + "#recap");
}
