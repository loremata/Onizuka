"use client";

import { useFormState } from "react-dom";
import { Button } from "@/components/ui/button";
import { Label } from "@/components/ui/label";
import { Select } from "@/components/ui/select";
import { Textarea } from "@/components/ui/textarea";
import { setMarketingPolicy, type MarketingPolicyActionResult } from "./actions";

const initial: MarketingPolicyActionResult = null;

const BASIS_OPTIONS = [
  {
    value: "LEGITIMATE_INTEREST",
    label: "Legittimo interesse — contattabile (consigliato)",
  },
  { value: "NONE", label: "Nessuna base — non contattabile finché non la assegni a mano" },
];

export function MarketingPolicyForm({
  autoBasis,
  excludedDomains,
}: {
  autoBasis: string;
  excludedDomains: string[];
}) {
  const [state, formAction] = useFormState(setMarketingPolicy, initial);

  return (
    <form action={formAction} className="max-w-xl space-y-4">
      {state && "error" in state && (
        <p className="text-sm text-destructive" role="alert">
          {state.error}
        </p>
      )}
      {state && "ok" in state && (
        <p className="text-sm text-muted-foreground" role="status">
          Impostazione salvata.{" "}
          {state.reclassified > 0
            ? `${state.reclassified} contatti riclassificati.`
            : "Nessun contatto da riclassificare."}
        </p>
      )}

      <div className="space-y-2">
        <Label htmlFor="marketingAutoBasis">Contatti trovati da fonti pubbliche</Label>
        <Select
          id="marketingAutoBasis"
          name="marketingAutoBasis"
          defaultValue={autoBasis}
          className="flex h-10 w-full rounded-md border border-input bg-background px-3 py-2 text-sm"
        >
          {BASIS_OPTIONS.map((o) => (
            <option key={o.value} value={o.value}>
              {o.label}
            </option>
          ))}
        </Select>
        <p className="text-xs text-muted-foreground">
          Vale per gli indirizzi reperiti da Google Business Profile, sito aziendale ed
          elenchi pubblici. Il provider di posta non conta: un&apos;attività che pubblica
          una casella Gmail sta pubblicando il proprio recapito commerciale come chiunque
          altro. Ogni email parte comunque con l&apos;origine dei dati dichiarata e il link
          di disiscrizione.
        </p>
      </div>

      <div className="space-y-2">
        <Label htmlFor="marketingExcludedDomains">Domini da escludere</Label>
        <Textarea
          id="marketingExcludedDomains"
          name="marketingExcludedDomains"
          rows={3}
          defaultValue={excludedDomains.join(", ")}
          placeholder="Vuoto = nessuna esclusione. Esempio: gmail.com, libero.it"
        />
        <p className="text-xs text-muted-foreground">
          Separa con virgole o a capo. Serve solo se una valutazione legale o una scelta
          organizzativa impone di restringere il campo: chi è già stato classificato non
          viene toccato, l&apos;esclusione vale sui contatti nuovi.
        </p>
      </div>

      <Button type="submit">Salva</Button>
    </form>
  );
}
