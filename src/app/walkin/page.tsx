import { Suspense } from "react";
import { WalkinQuickForm } from "@/components/onizuka/walkin-quick-form";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";

export const metadata = {
  title: "Walk-in · Onizuka",
  description: "Registrazione rapida in reception",
};

function FormFallback() {
  return <div className="h-48 animate-pulse rounded-md bg-muted" aria-hidden />;
}

export default function WalkinPage() {
  return (
    <main className="min-h-screen bg-background">
      <div className="container mx-auto max-w-md py-12 px-4">
        <Card>
          <CardHeader>
            <CardTitle>Benvenuto</CardTitle>
            <CardDescription>
              Compila il modulo per essere ricontattato. I dati vengono inviati al team Onizuka come nuovo lead.
            </CardDescription>
          </CardHeader>
          <CardContent>
            <Suspense fallback={<FormFallback />}>
              <WalkinQuickForm />
            </Suspense>
          </CardContent>
        </Card>
        <p className="mt-6 text-center text-xs text-muted-foreground">
          <a href="https://onizuka.it" className="hover:underline">
            onizuka.it
          </a>
        </p>
      </div>
    </main>
  );
}
