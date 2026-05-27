/** Prossimo retry automatico in base ai tentativi già effettuati. */
export function computeNextWebhookRetryAt(attemptsAfterFailure: number, from = new Date()): Date | null {
  const delaysMinutes = [15, 60, 240, 1440];
  const idx = attemptsAfterFailure - 2;
  if (idx < 0 || idx >= delaysMinutes.length) return null;
  return new Date(from.getTime() + delaysMinutes[idx]! * 60 * 1000);
}
