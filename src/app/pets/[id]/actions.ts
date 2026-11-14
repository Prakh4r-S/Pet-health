"use server";

import { revalidatePath } from "next/cache";
import { prisma } from "@/lib/prisma";
import { getCurrentUser } from "@/lib/current-user";
import { fail, ok, type ActionState } from "@/lib/action-result";

/**
 * Confirms the pet belongs to the signed-in user before any write.
 *
 * Without this, anyone could log a weight against any pet id — the id
 * comes from the URL, which is user-controlled. Ownership must be
 * checked on the server for every mutation, not assumed from the fact
 * that the UI only shows the user their own pets.
 *
 * This throws rather than returning a message: the forms that call these
 * actions are only rendered for the owner, so reaching here with someone
 * else's pet id is not a mistake a person makes by filling in a form.
 */
async function assertOwnership(petId: string) {
  const user = await getCurrentUser();
  const pet = await prisma.pet.findFirst({
    where: { id: petId, ownerId: user.id },
    select: { id: true, speciesId: true },
  });
  if (!pet) throw new Error("Pet not found.");
  return pet;
}

export async function logWeight(
  _previous: ActionState,
  formData: FormData,
): Promise<ActionState> {
  const petId = String(formData.get("petId") ?? "");
  await assertOwnership(petId);

  const weightKg = Number(formData.get("weightKg"));
  const measuredAtRaw = String(formData.get("measuredAt") ?? "");

  if (!Number.isFinite(weightKg) || weightKg <= 0 || weightKg > 200) {
    return fail("Enter a weight between 0 and 200 kg.");
  }

  const measuredAt = measuredAtRaw ? new Date(measuredAtRaw) : new Date();
  if (Number.isNaN(measuredAt.valueOf())) return fail("Enter a valid date.");
  if (measuredAt > new Date()) return fail("Date cannot be in the future.");

  // The schema allows one weight per pet per day, so a repeat entry for
  // the same date corrects the earlier one rather than failing.
  await prisma.weightLog.upsert({
    where: { petId_measuredAt: { petId, measuredAt } },
    update: { weightKg },
    create: { petId, weightKg, measuredAt },
  });

  revalidatePath(`/pets/${petId}`);
  return ok;
}

export async function logVaccination(
  _previous: ActionState,
  formData: FormData,
): Promise<ActionState> {
  const petId = String(formData.get("petId") ?? "");
  const pet = await assertOwnership(petId);

  const vaccineTypeId = String(formData.get("vaccineTypeId") ?? "");
  const administeredOnRaw = String(formData.get("administeredOn") ?? "");
  const administeredBy = String(formData.get("administeredBy") ?? "").trim() || null;

  if (!vaccineTypeId) return fail("Choose a vaccine.");
  if (!administeredOnRaw) return fail("Enter the date it was given.");

  const administeredOn = new Date(administeredOnRaw);
  if (Number.isNaN(administeredOn.valueOf())) return fail("Enter a valid date.");
  if (administeredOn > new Date()) return fail("Date cannot be in the future.");

  // Scoped to the pet's species: a rabbit cannot be given a canine vaccine
  // by posting a different id.
  const type = await prisma.vaccineType.findFirst({
    where: { id: vaccineTypeId, speciesId: pet.speciesId },
    select: { defaultIntervalMonths: true },
  });
  if (!type) return fail("Choose a vaccine.");

  // The next due date is computed once, on write, from the vaccine's own
  // interval — so the "what's due" query stays a plain indexed lookup
  // instead of recalculating intervals across every row at read time.
  let nextDueOn: Date | null = null;
  if (type.defaultIntervalMonths) {
    nextDueOn = new Date(administeredOn);
    nextDueOn.setMonth(nextDueOn.getMonth() + type.defaultIntervalMonths);
  }

  await prisma.vaccination.create({
    data: { petId, vaccineTypeId, administeredOn, nextDueOn, administeredBy },
  });

  revalidatePath(`/pets/${petId}`);
  return ok;
}
