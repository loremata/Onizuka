export type IcsEvent = {
  uid: string;
  title: string;
  start: Date;
  end: Date;
  description?: string;
  url?: string;
};

function formatIcsUtc(d: Date): string {
  return d.toISOString().replace(/[-:]/g, "").replace(/\.\d{3}Z$/, "Z");
}

function escapeIcs(text: string): string {
  return text.replace(/\\/g, "\\\\").replace(/\n/g, "\\n").replace(/,/g, "\\,").replace(/;/g, "\\;");
}

export function buildIcsCalendar(events: IcsEvent[], calendarName = "Onizuka Flow"): string {
  const lines = [
    "BEGIN:VCALENDAR",
    "VERSION:2.0",
    "PRODID:-//Onizuka//Flow Calendar//IT",
    "CALSCALE:GREGORIAN",
    "METHOD:PUBLISH",
    `X-WR-CALNAME:${escapeIcs(calendarName)}`,
  ];

  for (const e of events) {
    lines.push(
      "BEGIN:VEVENT",
      `UID:${e.uid}@onizuka`,
      `DTSTAMP:${formatIcsUtc(new Date())}`,
      `DTSTART:${formatIcsUtc(e.start)}`,
      `DTEND:${formatIcsUtc(e.end)}`,
      `SUMMARY:${escapeIcs(e.title)}`
    );
    if (e.description) lines.push(`DESCRIPTION:${escapeIcs(e.description)}`);
    if (e.url) lines.push(`URL:${e.url}`);
    lines.push("END:VEVENT");
  }

  lines.push("END:VCALENDAR");
  return lines.join("\r\n") + "\r\n";
}

export function flowTaskToIcsEvent(task: {
  id: string;
  title: string;
  dueDate: Date;
  description?: string | null;
  clientName?: string | null;
}): IcsEvent {
  const start = new Date(task.dueDate);
  const end = new Date(start.getTime() + 60 * 60 * 1000);
  const desc = [task.description, task.clientName ? `Cliente: ${task.clientName}` : null]
    .filter(Boolean)
    .join("\n");

  return {
    uid: task.id,
    title: task.title,
    start,
    end,
    description: desc || undefined,
    url: `${process.env.NEXTAUTH_URL ?? "http://localhost:3000"}/admin/flow`,
  };
}
