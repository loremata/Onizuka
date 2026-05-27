/** Ore SLA default per ticket portale cliente. */
export function resolveTicketSlaHours(clientHours: number | null | undefined): number {
  if (clientHours != null && clientHours > 0 && clientHours <= 720) return clientHours;
  const hours = Number(process.env.TICKET_SLA_HOURS ?? "48");
  return Number.isFinite(hours) && hours > 0 ? hours : 48;
}

export function defaultTicketSlaDueAt(from = new Date(), clientHours?: number | null): Date {
  const h = resolveTicketSlaHours(clientHours);
  return new Date(from.getTime() + h * 60 * 60 * 1000);
}
