import Link from "next/link";
import { featureReadiness, type FeatureKey } from "@/lib/feature-readiness";

/**
 * Avviso di funzione non collegata. Non compare nulla quando la funzione è
 * pronta: un banner che c'è sempre smette di essere letto.
 *
 * Dice tre cose, in quest'ordine: cosa NON succede (l'informazione che serve
 * davvero), cosa funziona lo stesso (perché la pagina resta utile), cosa
 * manca per collegarla. È la differenza tra "questa pagina è finta" e
 * "questa pagina fa meno di quanto sembra, ed ecco cosa".
 */
export function FeatureNotConfigured({ feature }: { feature: FeatureKey }) {
  const f = featureReadiness(feature);
  if (f.ready) return null;

  return (
    <div className="rounded-lg border border-amber-400/40 bg-amber-50 px-4 py-3 text-sm text-amber-900 dark:border-amber-400/30 dark:bg-amber-950/40 dark:text-amber-200">
      <p className="font-medium">{f.label}: non collegata</p>
      <p className="mt-1">
        Non succede questo: <strong>{f.doesNotHappen}</strong>.
      </p>
      <p className="mt-1 opacity-90">Funziona comunque: {f.worksAnyway}.</p>
      <p className="mt-1 text-xs opacity-80">
        Per collegarla serve {f.missing}.{" "}
        <Link href="/admin/settings" className="underline">
          Stato integrazioni
        </Link>
      </p>
    </div>
  );
}
