/** Skeleton durante navigazione nel portale cliente. */
export default function AppLoading() {
  return (
    <div className="space-y-6" role="status" aria-live="polite" aria-busy="true">
      <div className="h-10 w-64 max-w-full animate-pulse rounded-md bg-muted" />
      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
        {[1, 2, 3].map((i) => (
          <div key={i} className="h-48 animate-pulse rounded-lg border bg-muted/40" />
        ))}
      </div>
    </div>
  );
}
