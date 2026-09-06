"use server";

import { revalidatePath } from "next/cache";
import { prisma } from "@/lib/prisma";
import { getCurrentUser } from "@/lib/current-user";

const ACCEPTABLE_FIELDS = [
  "presentingComplaint",
  "examination",
  "assessment",
  "plan",
] as const;

type AcceptableField = (typeof ACCEPTABLE_FIELDS)[number];

async function getDraftNote(appointmentId: string) {
  const user = await getCurrentUser();

  const appointment = await prisma.appointment.findFirst({
    where: { id: appointmentId, vetProfile: { userId: user.id } },
    select: { id: true, petId: true, vetProfileId: true },
  });
  if (!appointment) throw new Error("Not your consultation.");

  const note = await prisma.consultationNote.upsert({
    where: { appointmentId },
    update: {},
    create: { appointmentId, vetProfileId: appointment.vetProfileId },
  });

  if (note.status === "FINALISED") {
    throw new Error("This note is finalised and cannot be changed.");
  }

  return { appointment, note };
}

/**
 * Copies one proposed field into the vet's draft note.
 *
 * Accepting is per-field and deliberate. A single "accept all" button
 * would make it trivially easy to sign off text nobody read, which is
 * exactly the failure mode that makes automated clinical notes
 * dangerous. The vet takes what is right, edits it, and leaves the rest.
 *
 * Note the value comes from the form rather than being re-read from the
 * stored extraction: the vet may have edited the text in the box before
 * accepting, and that edit should be what lands.
 */
export async function acceptProposedField(formData: FormData) {
  const appointmentId = String(formData.get("appointmentId") ?? "");
  const field = String(formData.get("field") ?? "") as AcceptableField;
  const value = String(formData.get("value") ?? "").trim();

  if (!ACCEPTABLE_FIELDS.includes(field)) throw new Error("Unknown field.");
  if (!value) throw new Error("Nothing to accept.");

  const { note } = await getDraftNote(appointmentId);

  // Append rather than replace when the vet has already written
  // something. Overwriting their own words with a machine's is the one
  // thing this must never do.
  const existing = (note[field] ?? "").trim();
  const next = existing ? `${existing}\n\n${value}` : value;

  await prisma.consultationNote.update({
    where: { id: note.id },
    data: { [field]: next },
  });

  revalidatePath(`/appointments/${appointmentId}/review`);
}

export async function acceptProposedMedication(formData: FormData) {
  const appointmentId = String(formData.get("appointmentId") ?? "");
  const { note, appointment } = await getDraftNote(appointmentId);

  const drug = String(formData.get("drug") ?? "").trim();
  const dose = String(formData.get("dose") ?? "").trim();
  const frequency = String(formData.get("frequency") ?? "").trim();
  const durationRaw = String(formData.get("durationDays") ?? "");

  // The proposal may legitimately have nulls — the transcript did not
  // state a dose. Those have to be filled in by the vet before this
  // becomes a prescription, rather than being defaulted to something
  // plausible.
  if (!drug || !dose || !frequency) {
    throw new Error("Fill in drug, dose and frequency before adding.");
  }

  const durationDays = durationRaw ? Number(durationRaw) : null;
  if (durationDays !== null && (!Number.isInteger(durationDays) || durationDays < 1)) {
    throw new Error("Duration must be a whole number of days.");
  }

  await prisma.prescription.create({
    data: {
      noteId: note.id,
      petId: appointment.petId,
      drug,
      dose,
      frequency,
      durationDays,
      instructions: String(formData.get("instructions") ?? "").trim() || null,
    },
  });

  revalidatePath(`/appointments/${appointmentId}/review`);
}
