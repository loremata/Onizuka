import Link from "next/link";
import { requireAdminArea } from "@/lib/admin-session";
import { Button } from "@/components/ui/button";
import { AutomationFlowBuilder } from "../automation-flow-builder";

export default async function AutomationFlowBuilderPage() {
  await requireAdminArea();

  return (
    <div className="space-y-6">
      <div>
        <Button asChild variant="ghost" size="sm">
          <Link href="/admin/automation-rules">← Regole auto</Link>
        </Button>
        <h1 className="mt-2 onizuka-page-title">Flow builder (n8n-style)</h1>
        <p className="text-muted-foreground">
          Trascina nodi, collega il flusso ed esporta JSON da importare come nuova regola.
        </p>
      </div>
      <AutomationFlowBuilder />
    </div>
  );
}
