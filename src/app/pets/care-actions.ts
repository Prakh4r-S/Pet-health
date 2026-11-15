"use server";

import { revalidatePath } from "next/cache";
import { prisma } from "@/lib/prisma";
import { getCurrentUser } from "@/lib/current-user";
import { fail, ok, type ActionState } from "@/lib/action-result";
import { isPrescriptionCurrent } from "@/lib/prescriptions";
import { UNDO_WINDOW_MINUTES } from "@/lib/care";

/** A second click this soon after the first is a double-click, not a second dose. */
const DUPLICATE_WINDOW_MS = 60_000;

/**
 * Records that the owner has just given a dose.
 *
 * Owner only. A treating vet reads this log; they do not write it — the
 * point of it is what happened at home. The prescription has to be one
 * a vet finalised and that is still running: a dose cannot be logged
 * against a course that ended, or against a draft.
 */
export async function markDoseGiven(
  _previous: ActionState,
  formData: FormData,
): Promise<ActionState> {
  const user = await getCurrentUser();
  const prescriptionId = String(formData.get("prescriptionId") ?? "");

  const prescription = await prisma.prescription.findFirst({
    where: {
      id: prescriptionId,
      pet: { ownerId: user.id, archivedAt: null },
      note: { status: "FINALISED" },
    },
    select: { id: true, petId: true, drug: true, createdAt: true, durationDays: true },
  });
  if (!prescription) return fail("That medication was not found.");

  const now = new Date();
  if (!isPrescriptionCurrent(prescription, now)) {
    return fail(`The course of ${prescription.drug} has ended.`);
  }

  const justLogged = await prisma.medicationDose.findFirst({
    where: {
      prescriptionId: prescription.id,
      givenAt: { gte: new Date(now.getTime() - DUPLICATE_WINDOW_MS) },
    },
    select: { id: true },
  });
  if (justLogged) {
    return fail("A dose was marked as given a moment ago. Wait a minute to log another.");
  }

  await prisma.medicationDose.create({
    data: { prescriptionId: prescription.id, loggedById: user.id, givenAt: now },
  });

  revalidatePath("/pets");
  revalidatePath(`/pets/${prescription.petId}`);
  return ok;
}

/**
 * Takes back a dose logged by mistake.
 *
 * Only your own, and only for a few minutes. After that the entry is
 * part of what the vet may already have read, and a record that can be
 * quietly edited later is not one they can rely on.
 */
export async function undoDose(
  _previous: ActionState,
  formData: FormData,
): Promise<ActionState> {
  const user = await getCurrentUser();
  const doseId = String(formData.get("doseId") ?? "");

  const dose = await prisma.medicationDose.findFirst({
    where: { id: doseId, loggedById: user.id },
    select: { id: true, createdAt: true, prescription: { select: { petId: true } } },
  });
  if (!dose) return fail("That entry was not found.");

  if (Date.now() - dose.createdAt.getTime() > UNDO_WINDOW_MINUTES * 60_000) {
    return fail(`An entry can only be undone within ${UNDO_WINDOW_MINUTES} minutes.`);
  }

  await prisma.medicationDose.delete({ where: { id: dose.id } });

  revalidatePath("/pets");
  revalidatePath(`/pets/${dose.prescription.petId}`);
  return ok;
}
