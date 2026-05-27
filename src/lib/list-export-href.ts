/** Costruisce query string per export CSV coerente con i filtri lista. */
export function buildListExportHref(
  basePath: string,
  params: Record<string, string | undefined | null>
): string {
  const p = new URLSearchParams();
  for (const [key, value] of Object.entries(params)) {
    if (value?.trim()) p.set(key, value.trim());
  }
  const q = p.toString();
  return q ? `${basePath}?${q}` : basePath;
}
