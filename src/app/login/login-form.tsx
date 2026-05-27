"use client";

import { useState } from "react";
import { signIn } from "next-auth/react";
import { useSearchParams } from "next/navigation";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";

export function LoginForm({ entraEnabled }: { entraEnabled: boolean }) {
  const searchParams = useSearchParams();
  const callbackUrl = searchParams.get("callbackUrl") ?? "/";
  const error = searchParams.get("error");
  const passwordChanged = searchParams.get("passwordChanged") === "1";

  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [loading, setLoading] = useState(false);
  const [formError, setFormError] = useState<string | null>(null);

  async function onSubmit(e: React.FormEvent) {
    e.preventDefault();
    setFormError(null);
    setLoading(true);

    try {
      const res = await signIn("credentials", {
        email,
        password,
        redirect: false,
      });

      if (res?.error) {
        setFormError("Email o password non validi.");
        setLoading(false);
        return;
      }

      window.location.href = callbackUrl;
    } catch {
      setFormError("Si è verificato un errore. Riprova.");
      setLoading(false);
    }
  }

  return (
    <div className="onizuka-shell-bg flex min-h-screen items-center justify-center px-4">
      <Card className="w-full max-w-md border-border/80 bg-card/95 shadow-xl shadow-black/20">
        <CardHeader className="space-y-3 text-center">
          <div className="mx-auto flex h-12 w-12 items-center justify-center rounded-xl bg-primary/15 text-lg font-bold text-primary ring-1 ring-primary/30">
            O
          </div>
          <CardTitle className="text-2xl tracking-tight">Onizuka</CardTitle>
          <CardDescription>Business Operating System · accesso interno</CardDescription>
        </CardHeader>
        <CardContent>
          {entraEnabled ? (
            <div className="mb-4 space-y-2">
              <Button
                type="button"
                variant="outline"
                className="w-full"
                disabled={loading}
                onClick={() => signIn("azure-ad", { callbackUrl })}
              >
                Accedi con Microsoft (Entra ID)
              </Button>
              <p className="text-center text-xs text-muted-foreground">oppure email e password</p>
            </div>
          ) : null}
          <form onSubmit={onSubmit} className="space-y-4">
            {passwordChanged ? (
              <div className="rounded-md bg-green-500/10 p-3 text-sm text-green-700 dark:text-green-400">
                Password aggiornata. Accedi con la nuova password.
              </div>
            ) : null}
            {(error === "CredentialsSignin" || error === "AccessDenied" || formError) && (
              <div className="rounded-md bg-destructive/10 p-3 text-sm text-destructive">
                {error === "AccessDenied"
                  ? "Account non autorizzato per SSO Microsoft. Usa un utente ADMIN/STAFF già registrato."
                  : formError ?? "Email o password non validi."}
              </div>
            )}
            <div className="space-y-2">
              <label htmlFor="email" className="text-sm font-medium">
                Email
              </label>
              <Input
                id="email"
                name="email"
                type="email"
                autoComplete="email"
                placeholder="you@company.com"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                required
                readOnly={loading}
              />
            </div>
            <div className="space-y-2">
              <label htmlFor="password" className="text-sm font-medium">
                Password
              </label>
              <Input
                id="password"
                name="password"
                type="password"
                autoComplete="current-password"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                required
                readOnly={loading}
              />
            </div>
            <Button type="submit" className="w-full" disabled={loading}>
              {loading ? "Accesso in corso…" : "Accedi"}
            </Button>
          </form>
          {process.env.NODE_ENV === "development" ? (
            <p className="mt-4 rounded-md bg-muted/60 p-3 text-center text-xs text-muted-foreground">
              Demo locale: <span className="font-mono">admin@agency.com</span> /{" "}
              <span className="font-mono">admin123</span>
              <br />
              Cliente: <span className="font-mono">client@democlient.com</span> /{" "}
              <span className="font-mono">client123</span>
              <br />
              Se il login fallisce, avvia Docker Desktop e <span className="font-mono">npm run db:sync</span>.
            </p>
          ) : (
            <p className="mt-4 text-center text-sm text-muted-foreground">
              Per ottenere l&apos;accesso contatta l&apos;amministratore.
            </p>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
