import { requireAdminArea } from "@/lib/admin-session";
import { PROVINCE_ITALIA } from "@/lib/scraping/comuni-italia";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { ScrapingClient } from "./scraping-client";

export const metadata = { title: "Scraping aziende per comune" };

export default async function ScrapingPage() {
  await requireAdminArea();

  const province = PROVINCE_ITALIA.map((p) => ({ nome: p.nome, sigla: p.sigla, regione: p.regione }));

  return (
    <div className="space-y-6">
      <Card>
        <CardHeader>
          <CardTitle>Scraping aziende per comune</CardTitle>
          <CardDescription>
            Seleziona provincia e comune e avvia lo scraping. Le aziende <strong>attive</strong> vengono
            importate come Lead (deduplicate: mai la stessa azienda due volte); le cessate/in liquidazione
            sono escluse. Il lavoro gira sul worker sul tuo PC — assicurati che sia avviato.
          </CardDescription>
        </CardHeader>
        <CardContent>
          <ScrapingClient province={province} />
        </CardContent>
      </Card>
    </div>
  );
}
