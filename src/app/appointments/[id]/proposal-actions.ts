"use server";

import { revalidatePath } from "next/cache";
import { prisma } from "@/lib/prisma";
import { getCurrentUser } from "@/lib/current-user";
import { fail, ok, type ActionState } from "@/lib/action-result";

const ACCEPTABLE_FIELDS = [
  "presentingComplaint",
  "examination",
  "assessment",
  "plan",
  "followUpNote",
] as const;

type AcceptableField = (typeof ACCEPTABLE_FIELDS)[number];

const FINALISED = "This note is finalised and cannot be changed.";

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
export async function acceptProposedField(
  _previous: ActionState,
  formData: FormData,
): Promise<ActionState> {
  const appointmentId = String(formData.get("appointmentId") ?? "");
  const field = String(formData.get("field") ?? "") as AcceptableField;
  const value = String(formData.get("value") ?? "").trim();

  // Not something a form can produce — the field name is a hidden input.
  if (!ACCEPTABLE_FIELDS.includes(field)) throw new Error("Unknown field.");
  if (!value) return fail("Nothing to add — the text is empty.");

  const { note } = await getDraftNote(appointmentId);
  if (note.status === "FINALISED") return fail(FINALISED);

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
  return ok;
}

export async function acceptProposedMedication(
  _previous: ActionState,
  formData: FormData,
): Promise<ActionState> {
  const appointmentId = String(formData.get("appointmentId") ?? "");
  const { note, appointment } = await getDraftNote(appointmentId);
  if (note.status === "FINALISED") return fail(FINALISED);

  const drug = String(formData.get("drug") ?? "").trim();
  const dose = String(formData.get("dose") ?? "").trim();
  const frequency = String(formData.get("frequency") ?? "").trim();
  const durationRaw = String(formData.get("durationDays") ?? "");

  // The proposal may legitimately have nulls — the transcript did not
  // state a dose. Those have to be filled in by the vet before this
  // becomes a prescription, rather than being defaulted to something
  // plausible.
  if (!drug || !dose || !frequency) {
    return fail("Fill in drug, dose and frequency before adding.");
  }

  const durationDays = durationRaw ? Number(durationRaw) : null;
  if (durationDays !== null && (!Number.isInteger(durationDays) || durationDays < 1)) {
    return fail("Duration must be a whole number of days.");
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
  return ok;
}
