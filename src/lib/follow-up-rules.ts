/**
 * The rules and shapes of the post-consultation follow-up thread.
 *
 * No server-only imports: the thread's form is a client component and
 * reads its limits from here; the loader that touches the database is
 * in lib/follow-up.
 */

export const FOLLOW_UP_WINDOW_HOURS = 48;
export const MAX_FOLLOW_UP_CHARS = 1000;
/** Per thread. A follow-up is a few questions, not a conversation to be had here. */
export const MAX_FOLLOW_UP_MESSAGES = 30;

/**
 * When the thread for a completed appointment stops taking messages, or
 * null if it never opened.
 *
 * The 48 hours run from the end of the appointment — or from when the
 * vet finalised the record, if that came later. An appointment only
 * becomes COMPLETED at that moment, so counting strictly from `endsAt`
 * would hand a shortened window, or none at all, to every owner whose
 * vet wrote the notes up the next day.
 */
export function followUpClosesAt(appointment: {
  status: string;
  endsAt: Date;
  note?: { finalisedAt: Date | null } | null;
}) {
  if (appointment.status !== "COMPLETED") return null;
  const from = Math.max(
    appointment.endsAt.getTime(),
    appointment.note?.finalisedAt?.getTime() ?? 0,
  );
  return new Date(from + FOLLOW_UP_WINDOW_HOURS * 3_600_000);
}

export type FollowUpMessageView = {
  id: string;
  body: string;
  createdAt: string;
  authorName: string;
  /** Whether the vet on the appointment wrote it, as opposed to the owner. */
  fromVet: boolean;
  /** Whether the person looking at the thread wrote it. */
  mine: boolean;
  photo: { documentId: string; title: string } | null;
};

export type FollowUpThread = {
  appointmentId: string;
  /** ISO time the thread closes; null if it never opened. */
  closesAt: string | null;
  open: boolean;
  messages: FollowUpMessageView[];
};
