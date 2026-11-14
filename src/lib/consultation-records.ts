import type { Prisma } from "@/generated/prisma/client";

/**
 * What is read from the database to show a consultation to the owner.
 *
 * Note what is not selected: `scratch`. Those are the vet's working
 * notes from during the call, never part of the finalised record, and
 * they do not belong in front of the owner.
 */
export const consultationRecordSelect = {
  status: true,
  presentingComplaint: true,
  examination: true,
  assessment: true,
  plan: true,
  followUpOn: true,
  finalisedAt: true,
  prescriptions: {
    orderBy: { createdAt: "asc" },
    select: {
      id: true,
      drug: true,
      dose: true,
      frequency: true,
      durationDays: true,
      instructions: true,
    },
  },
  amendments: {
    orderBy: { createdAt: "asc" },
    select: {
      id: true,
      body: true,
      createdAt: true,
      author: { select: { name: true } },
    },
  },
} satisfies Prisma.ConsultationNoteSelect;

type SelectedNote = Prisma.ConsultationNoteGetPayload<{
  select: typeof consultationRecordSelect;
}>;

export type ConsultationRecord = {
  presentingComplaint: string | null;
  examination: string | null;
  assessment: string | null;
  plan: string | null;
  followUpOn: string | null;
  finalisedAt: string | null;
  prescriptions: SelectedNote["prescriptions"];
  amendments: { id: string; body: string; createdAt: string; authorName: string | null }[];
};

/**
 * The owner-facing form of a note, or null if there is nothing they may
 * see yet.
 *
 * Only a finalised note qualifies. A draft is the vet's work in progress
 * and may hold machine-proposed text nobody has checked; showing it to
 * an owner as what the vet said would misrepresent it. This is the same
 * rule the assistant's context applies, and the one place it is decided
 * for the pages.
 */
export function toOwnerRecord(note: SelectedNote | null): ConsultationRecord | null {
  if (!note || note.status !== "FINALISED") return null;

  return {
    presentingComplaint: note.presentingComplaint,
    examination: note.examination,
    assessment: note.assessment,
    plan: note.plan,
    followUpOn: note.followUpOn?.toISOString().slice(0, 10) ?? null,
    finalisedAt: note.finalisedAt?.toISOString() ?? null,
    prescriptions: note.prescriptions,
    amendments: note.amendments.map((a) => ({
      id: a.id,
      body: a.body,
      createdAt: a.createdAt.toISOString(),
      authorName: a.author.name,
    })),
  };
}
