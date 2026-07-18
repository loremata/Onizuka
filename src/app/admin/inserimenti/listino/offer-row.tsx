"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { updateOffer } from "../actions";

interface Offer {
  id: string;
  name: string;
  code: string;
  lineKey: string | null;
  category: string | null;
  feeEur: number;
  active: boolean;
}

export function OfferRow({ offer, piste }: { offer: Offer; piste: string[] }) {
  // le piste disponibili sono quelle del piano di QUESTO brand, non un elenco
  // fisso: Fastweb ha FISSO/MOBILE/business, TIM ha le sue gare.
  const opzioni = ["", ...piste];
  const router = useRouter();
  const [fee, setFee] = useState(String(offer.feeEur).replace(".", ","));
  const [lineKey, setLineKey] = useState(offer.lineKey ?? "");
  const [active, setActive] = useState(offer.active);
  const [dirty, setDirty] = useState(false);
  const [saving, setSaving] = useState(false);

  async function save() {
    setSaving(true);
    await updateOffer(offer.id, { feeEur: fee, lineKey, active });
    setSaving(false);
    setDirty(false);
    router.refresh();
  }

  // sotto 8 € il gettone di gara non si prende: si vede a colpo d'occhio
  const f = parseFloat(fee.replace(",", "."));
  const isMobile = lineKey === "MNP" || lineKey === "AL_PP";
  const noGettone = isMobile && Number.isFinite(f) && f < 8;
  const mezzoGettone = isMobile && Number.isFinite(f) && f >= 8 && f < 9;

  return (
    <tr className={"border-b last:border-0 " + (active ? "" : "opacity-40")}>
      <td className="py-2 pr-4">
        <div className="font-medium">{offer.name}</div>
        {offer.category ? <div className="text-xs text-muted-foreground">{offer.category}</div> : null}
      </td>
      <td className="py-2 pr-4 font-mono text-xs text-muted-foreground">{offer.code}</td>
      <td className="py-2 pr-4">
        <select
          value={lineKey}
          onChange={(e) => {
            setLineKey(e.target.value);
            setDirty(true);
          }}
          className="rounded border bg-background px-2 py-1 text-xs"
        >
          {opzioni.map((p) => (
            <option key={p} value={p}>
              {p || "— da scegliere —"}
            </option>
          ))}
        </select>
      </td>
      <td className="py-2 pr-4 text-right">
        <input
          value={fee}
          onChange={(e) => {
            setFee(e.target.value);
            setDirty(true);
          }}
          inputMode="decimal"
          className="w-20 rounded border bg-background px-2 py-1 text-right text-xs tabular-nums"
        />
        {noGettone ? (
          <div className="text-xs text-red-600" title="sotto 8 €: conta per la soglia ma non paga il gettone">
            no gettone
          </div>
        ) : mezzoGettone ? (
          <div className="text-xs text-amber-600">gettone 50%</div>
        ) : null}
      </td>
      <td className="py-2 pr-4 text-right">
        <input
          type="checkbox"
          checked={active}
          onChange={(e) => {
            setActive(e.target.checked);
            setDirty(true);
          }}
        />
        {dirty ? (
          <button
            onClick={save}
            disabled={saving}
            className="ml-2 rounded bg-primary px-2 py-1 text-xs text-primary-foreground disabled:opacity-50"
          >
            {saving ? "…" : "Salva"}
          </button>
        ) : null}
      </td>
    </tr>
  );
}
