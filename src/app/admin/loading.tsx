/** Skeleton durante navigazione tra pagine admin (Next.js streaming). */
export default function AdminLoading() {
  return (
    <div className="space-y-6" role="status" aria-live="polite" aria-busy="true">
      <div className="h-9 w-56 max-w-full animate-pulse rounded-md bg-muted" />
      <div className="h-32 w-full max-w-2xl animate-pulse rounded-lg border bg-muted/50" />
      <div className="h-48 w-full animate-pulse rounded-lg border bg-muted/30" />
    </div>
  );
}
