"use server";

import { revalidatePath } from "next/cache";
import { prisma } from "@/lib/prisma";
import { getCurrentUser } from "@/lib/current-user";
import { fail, ok, type ActionState } from "@/lib/action-result";

/**
 * Confirms the signed-in user is the vet on this appointment, and
 * returns the note, creating it on first use.
 *
 * The note is created lazily rather than at booking time — most
 * appointments never get one, and an empty draft for every future
 * booking is clutter.
 *
 * Throws for anyone else: these actions are reachable only from the
 * vet's own review page, so a mismatch is not a form-filling mistake.
 */
async function getOwnNote(appointmentId: string) {
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

  return { user, appointment, note };
}

/** Free text typed during the call. Always editable, never part of the
 *  finalised record — it is the vet's own working memory. */
export async function saveScratch(appointmentId: string, scratch: string) {
  const { note } = await getOwnNote(appointmentId);

  await prisma.consultationNote.update({
    where: { id: note.id },
    data: { scratch },
  });
}

/**
 * The structured fields of the draft, as posted by the review form.
 * Shared by saving and finalising, which both accept the whole form.
 */
function readDraftFields(formData: FormData) {
  const text = (name: string) => String(formData.get(name) ?? "").trim() || null;

  const followUpRaw = String(formData.get("followUpOn") ?? "");
  const followUpOn = followUpRaw ? new Date(followUpRaw) : null;
  if (followUpOn && Number.isNaN(followUpOn.valueOf())) {
    return { ok: false as const, error: "Enter a valid follow-up date." };
  }

  return {
    ok: true as const,
    data: {
      presentingComplaint: text("presentingComplaint"),
      examination: text("examination"),
      assessment: text("assessment"),
      plan: text("plan"),
      followUpOn,
      followUpNote: text("followUpNote"),
    },
  };
}

export async function saveNoteDraft(
  _previous: ActionState,
  formData: FormData,
): Promise<ActionState> {
  const appointmentId = String(formData.get("appointmentId") ?? "");
  const { note } = await getOwnNote(appointmentId);

  if (note.status === "FINALISED") {
    return fail("This note is finalised. Add an amendment instead.");
  }

  const fields = readDraftFields(formData);
  if (!fields.ok) return fail(fields.error);

  await prisma.consultationNote.update({
    where: { id: note.id },
    data: fields.data,
  });

  revalidatePath(`/appointments/${appointmentId}/review`);
  return ok;
}

export async function finaliseNote(
  _previous: ActionState,
  formData: FormData,
): Promise<ActionState> {
  const appointmentId = String(formData.get("appointmentId") ?? "");
  const { note, appointment } = await getOwnNote(appointmentId);

  if (note.status === "FINALISED") return ok;

  // The review page sends the whole draft form with the finalise
  // request, so what the vet sees on screen when they confirm is what
  // gets locked — not whatever was last saved. Without this, an edit
  // made after the last "Save draft" would be silently dropped at the
  // one moment it matters most. A request without the form (an older
  // page) finalises the saved draft as before.
  let draft: ReturnType<typeof readDraftFields> | null = null;
  if (formData.has("assessment")) {
    draft = readDraftFields(formData);
    if (!draft.ok) return fail(draft.error);
  }

  const assessment = draft?.ok ? draft.data.assessment : note.assessment;

  // A note with nothing in it is not a record. Requiring an assessment
  // is a low bar, but it stops empty notes being signed off by accident.
  if (!assessment?.trim()) {
    return fail("Add a clinical assessment before finalising.");
  }

  const now = new Date();
  await prisma.$transaction([
    // Conditional on still being a draft: two tabs finalising at once
    // must not both write, and the second must not overwrite the first.
    prisma.consultationNote.updateMany({
      where: { id: note.id, status: "DRAFT" },
      data: {
        ...(draft?.ok ? draft.data : {}),
        status: "FINALISED",
        finalisedAt: now,
      },
    }),
    // Finalising the note is also what marks the consultation done —
    // the two facts are the same event and should not be able to drift
    // apart.
    prisma.appointment.update({
      where: { id: appointment.id },
      data: { status: "COMPLETED" },
    }),
  ]);

  revalidatePath(`/appointments/${appointmentId}/review`);
  revalidatePath("/vet/appointments");
  // Finalising is what shares the record with the owner: their pages
  // show finalised notes only (see lib/consultation-records).
  revalidatePath("/appointments");
  revalidatePath(`/pets/${appointment.petId}`);
  return ok;
}

export async function addAmendment(
  _previous: ActionState,
  formData: FormData,
): Promise<ActionState> {
  const appointmentId = String(formData.get("appointmentId") ?? "");
  const body = String(formData.get("body") ?? "").trim();

  const { user, note } = await getOwnNote(appointmentId);

  if (!body) return fail("Write something first.");
  if (note.status !== "FINALISED") {
    return fail("Edit the draft directly — amendments are for finalised notes.");
  }

  await prisma.noteAmendment.create({
    data: { noteId: note.id, authorId: user.id, body },
  });

  revalidatePath(`/appointments/${appointmentId}/review`);
  return ok;
}

export async function addPrescription(
  _previous: ActionState,
  formData: FormData,
): Promise<ActionState> {
  const appointmentId = String(formData.get("appointmentId") ?? "");
  const { note, appointment } = await getOwnNote(appointmentId);

  if (note.status === "FINALISED") {
    return fail("This note is finalised. Add an amendment instead.");
  }

  const drug = String(formData.get("drug") ?? "").trim();
  const dose = String(formData.get("dose") ?? "").trim();
  const frequency = String(formData.get("frequency") ?? "").trim();
  const durationRaw = String(formData.get("durationDays") ?? "");

  if (!drug || !dose || !frequency) {
    return fail("Drug, dose and frequency are all required.");
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

export async function removePrescription(
  _previous: ActionState,
  formData: FormData,
): Promise<ActionState> {
  const appointmentId = String(formData.get("appointmentId") ?? "");
  const id = String(formData.get("id") ?? "");
  const { note } = await getOwnNote(appointmentId);

  if (note.status === "FINALISED") {
    return fail("This note is finalised and cannot be changed.");
  }

  // Scoped to this note, so a guessed id from another consultation
  // cannot be removed.
  await prisma.prescription.deleteMany({ where: { id, noteId: note.id } });

  revalidatePath(`/appointments/${appointmentId}/review`);
  return ok;
}
