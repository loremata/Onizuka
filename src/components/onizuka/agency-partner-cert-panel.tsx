"use client";

import { useState, useTransition } from "react";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { updateAgencyPartnerCertAction } from "@/app/admin/settings/partner-cert-actions";

type Props = {
  initial: {
    zucchettiOfficial: boolean;
    sapOfficial: boolean;
    zucchettiPartnerRef: string | null;
    sapPartnerRef: string | null;
    zucchettiContractDriveUrl: string | null;
    sapContractDriveUrl: string | null;
    legalArchiveNotes: string | null;
    contractSignedAt: string | null;
  };
};

export function AgencyPartnerCertPanel({ initial }: Props) {
  const [zucchetti, setZucchetti] = useState(initial.zucchettiOfficial);
  const [sap, setSap] = useState(initial.sapOfficial);
  const [zRef, setZRef] = useState(initial.zucchettiPartnerRef ?? "");
  const [sRef, setSRef] = useState(initial.sapPartnerRef ?? "");
  const [zDrive, setZDrive] = useState(initial.zucchettiContractDriveUrl ?? "");
  const [sDrive, setSDrive] = useState(initial.sapContractDriveUrl ?? "");
  const [legalNotes, setLegalNotes] = useState(initial.legalArchiveNotes ?? "");
  const [msg, setMsg] = useState<string | null>(null);
  const [pending, start] = useTransition();

  return (
    <Card className="max-w-2xl border-dashed">
      <CardHeader>
        <CardTitle>Certificazioni partner ERP</CardTitle>
        <CardDescription>
          Badge Time/go-live + archivio legale contratti (URL Drive o cartella documentale).
        </CardDescription>
      </CardHeader>
      <CardContent className="space-y-3 text-sm">
        {initial.contractSignedAt ? (
          <p className="text-xs text-muted-foreground">
            Ultimo aggiornamento contratto:{" "}
            {new Date(initial.contractSignedAt).toLocaleString("it-IT")}
          </p>
        ) : null}
        <label className="flex items-center gap-2">
          <input type="checkbox" checked={zucchetti} onChange={(e) => setZucchetti(e.target.checked)} />
          Zucchetti partner ufficiale
        </label>
        <input
          className="w-full rounded-md border px-2 py-1 font-mono text-xs"
          placeholder="ID partner Zucchetti"
          value={zRef}
          onChange={(e) => setZRef(e.target.value)}
        />
        <input
          className="w-full rounded-md border px-2 py-1 text-xs"
          placeholder="URL Drive contratto Zucchetti (archivio legale)"
          value={zDrive}
          onChange={(e) => setZDrive(e.target.value)}
        />
        <label className="flex items-center gap-2">
          <input type="checkbox" checked={sap} onChange={(e) => setSap(e.target.checked)} />
          SAP partner ufficiale
        </label>
        <input
          className="w-full rounded-md border px-2 py-1 font-mono text-xs"
          placeholder="ID partner SAP"
          value={sRef}
          onChange={(e) => setSRef(e.target.value)}
        />
        <input
          className="w-full rounded-md border px-2 py-1 text-xs"
          placeholder="URL Drive contratto SAP"
          value={sDrive}
          onChange={(e) => setSDrive(e.target.value)}
        />
        <textarea
          className="min-h-[60px] w-full rounded-md border px-2 py-1 text-xs"
          placeholder="Note archivio legale (opzionale)"
          value={legalNotes}
          onChange={(e) => setLegalNotes(e.target.value)}
        />
        <Button
          type="button"
          size="sm"
          disabled={pending}
          onClick={() => {
            setMsg(null);
            start(async () => {
              const res = await updateAgencyPartnerCertAction({
                zucchettiOfficial: zucchetti,
                sapOfficial: sap,
                zucchettiPartnerRef: zRef,
                sapPartnerRef: sRef,
                zucchettiContractDriveUrl: zDrive,
                sapContractDriveUrl: sDrive,
                legalArchiveNotes: legalNotes,
              });
              setMsg(res.error ?? "Salvato.");
            });
          }}
        >
          Salva certificazioni e archivio
        </Button>
        {msg ? <p className="text-xs text-muted-foreground">{msg}</p> : null}
      </CardContent>
    </Card>
  );
}
