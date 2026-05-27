/** Aggiunge giorni lavorativi (lun–ven) a partire da `from`, ore 09:00. */
export function addBusinessDays(from: Date, businessDays: number): Date {
  const d = new Date(from);
  let added = 0;
  while (added < businessDays) {
    d.setDate(d.getDate() + 1);
    const day = d.getDay();
    if (day !== 0 && day !== 6) added += 1;
  }
  d.setHours(9, 0, 0, 0);
  return d;
}
