import { Suspense } from "react";
import { LoginForm } from "./login-form";

function isEntraSsoEnabled(): boolean {
  return !!(
    process.env.AZURE_AD_CLIENT_ID?.trim() &&
    process.env.AZURE_AD_CLIENT_SECRET?.trim()
  );
}

export default function LoginPage() {
  const entraEnabled = isEntraSsoEnabled();

  return (
    <Suspense
      fallback={
        <div
          className="flex min-h-screen items-center justify-center bg-background px-4 text-sm text-muted-foreground"
          role="status"
          aria-live="polite"
        >
          Caricamento…
        </div>
      }
    >
      <LoginForm entraEnabled={entraEnabled} />
    </Suspense>
  );
}
