/** Mostrato mentre si carica la pagina di login (Suspense + bundle client). */
export default function LoginLoading() {
  return (
    <div className="flex min-h-screen items-center justify-center bg-muted/30 px-4">
      <div className="w-full max-w-md space-y-4 rounded-lg border bg-card p-6 shadow-sm">
        <div className="mx-auto h-8 w-32 animate-pulse rounded-md bg-muted" />
        <div className="mx-auto h-4 w-56 animate-pulse rounded-md bg-muted" />
        <div className="space-y-2 pt-4">
          <div className="h-10 w-full animate-pulse rounded-md bg-muted" />
          <div className="h-10 w-full animate-pulse rounded-md bg-muted" />
        </div>
        <div className="h-10 w-full animate-pulse rounded-md bg-muted" />
      </div>
    </div>
  );
}
