export type TicketUpdateActivity = {
  createdByUserId: string | null;
  clientReadAt: Date | null;
};

export type TicketWithActivity = {
  updates: TicketUpdateActivity[];
};

/** Risposta admin non ancora vista dal cliente. */
export function isAdminReplyUnread(update: TicketUpdateActivity): boolean {
  return Boolean(update.createdByUserId) && !update.clientReadAt;
}

export function isTicketUnread(ticket: TicketWithActivity): boolean {
  return ticket.updates.some(isAdminReplyUnread);
}

export function countUnreadTickets(tickets: TicketWithActivity[]): number {
  return tickets.filter(isTicketUnread).length;
}

export function countUnreadAdminReplies(ticket: TicketWithActivity): number {
  return ticket.updates.filter(isAdminReplyUnread).length;
}
