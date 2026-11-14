"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
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
    where: { id: petId, ownerId: user.id, archivedAt: null },
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

// ---------------------------------------------------------------
// Profile
// ---------------------------------------------------------------

const SEXES = ["MALE", "FEMALE", "UNKNOWN"] as const;

/** "2024-03-01" -> Date, "" -> null, anything else -> undefined (invalid). */
function parseOptionalDate(raw: string): Date | null | undefined {
  if (!raw) return null;
  if (!/^\d{4}-\d{2}-\d{2}$/.test(raw)) return undefined;
  const date = new Date(raw);
  return Number.isNaN(date.valueOf()) ? undefined : date;
}

/**
 * Edits the details that describe the animal.
 *
 * Species is deliberately not editable: the vaccination checklist and
 * every vaccination already recorded hang off it, so changing a dog into
 * a cat would leave canine vaccines on a feline record. A pet entered
 * under the wrong species should be archived and re-added.
 *
 * Weight is not here either — it is a dated measurement, logged from the
 * weight section, not a property to overwrite.
 */
export async function updatePet(
  _previous: ActionState,
  formData: FormData,
): Promise<ActionState> {
  const petId = String(formData.get("petId") ?? "");
  const pet = await assertOwnership(petId);

  const name = String(formData.get("name") ?? "").trim();
  const breedId = String(formData.get("breedId") ?? "") || null;
  const breedFreeText = String(formData.get("breedFreeText") ?? "").trim() || null;
  const sexRaw = String(formData.get("sex") ?? "UNKNOWN");
  const neuteredRaw = String(formData.get("neutered") ?? "");
  const microchipNumber = String(formData.get("microchipNumber") ?? "").trim() || null;
  const birthDate = parseOptionalDate(String(formData.get("birthDate") ?? ""));
  const birthDateIsApprox = formData.get("birthDateIsApprox") === "on";

  if (!name) return fail("Name is required.");
  if (name.length > 80) return fail("That name is too long.");
  if (birthDate === undefined) return fail("Enter a valid date of birth.");
  if (birthDate && birthDate > new Date()) return fail("Date of birth cannot be in the future.");
  if (microchipNumber && microchipNumber.length > 40) {
    return fail("That microchip number is too long.");
  }

  if (breedId) {
    const breed = await prisma.breed.findFirst({
      where: { id: breedId, speciesId: pet.speciesId },
      select: { id: true },
    });
    if (!breed) return fail("Choose a breed from the list.");
  }

  await prisma.pet.update({
    where: { id: pet.id },
    data: {
      name,
      breedId,
      breedFreeText,
      sex: (SEXES as readonly string[]).includes(sexRaw)
        ? (sexRaw as (typeof SEXES)[number])
        : "UNKNOWN",
      // Three states, not two: "not recorded" is different from "no".
      neutered: neuteredRaw === "yes" ? true : neuteredRaw === "no" ? false : null,
      microchipNumber,
      birthDate,
      birthDateIsApprox: birthDate ? birthDateIsApprox : false,
    },
  });

  revalidatePath(`/pets/${pet.id}`);
  revalidatePath("/pets");
  return ok;
}

/**
 * Removes a pet from the owner's list without destroying its records.
 *
 * Archiving is a soft delete — consultation notes and prescriptions are
 * clinical history and outlive the listing. It is refused while an
 * appointment is still booked: the vet would arrive at a consultation
 * for a patient whose records they can no longer open.
 */
export async function archivePet(
  _previous: ActionState,
  formData: FormData,
): Promise<ActionState> {
  const petId = String(formData.get("petId") ?? "");
  const pet = await assertOwnership(petId);

  const upcoming = await prisma.appointment.count({
    where: { petId: pet.id, status: "SCHEDULED", endsAt: { gte: new Date() } },
  });
  if (upcoming > 0) {
    return fail(
      upcoming === 1
        ? "This pet has an appointment booked. Cancel it before archiving."
        : `This pet has ${upcoming} appointments booked. Cancel them before archiving.`,
    );
  }

  await prisma.pet.update({
    where: { id: pet.id },
    data: { archivedAt: new Date() },
  });

  revalidatePath("/pets");
  redirect("/pets");
}

// ---------------------------------------------------------------
// Allergies and conditions
// ---------------------------------------------------------------

const SEVERITIES = ["MILD", "MODERATE", "SEVERE", "UNKNOWN"] as const;

export async function addAllergy(
  _previous: ActionState,
  formData: FormData,
): Promise<ActionState> {
  const petId = String(formData.get("petId") ?? "");
  const pet = await assertOwnership(petId);

  const allergen = String(formData.get("allergen") ?? "").trim();
  const reaction = String(formData.get("reaction") ?? "").trim() || null;
  const severityRaw = String(formData.get("severity") ?? "UNKNOWN");

  if (!allergen) return fail("Say what the allergy is to.");
  if (allergen.length > 120) return fail("Keep the allergen short — a name, not a description.");

  // The same allergen listed twice makes the vet's panel harder to read
  // at exactly the moment it needs to be read quickly.
  const existing = await prisma.allergy.findFirst({
    where: { petId: pet.id, active: true, allergen: { equals: allergen, mode: "insensitive" } },
    select: { id: true },
  });
  if (existing) return fail(`${allergen} is already listed.`);

  await prisma.allergy.create({
    data: {
      petId: pet.id,
      allergen,
      reaction,
      severity: (SEVERITIES as readonly string[]).includes(severityRaw)
        ? (severityRaw as (typeof SEVERITIES)[number])
        : "UNKNOWN",
    },
  });

  revalidatePath(`/pets/${pet.id}`);
  return ok;
}

/**
 * Takes an allergy off the active list.
 *
 * The row is marked inactive rather than deleted. Everything that reads
 * allergies — this page, the vet's panel, the assistant — shows only
 * active ones, so the effect for the owner is removal, while the fact
 * that it was once recorded is not erased.
 */
export async function removeAllergy(
  _previous: ActionState,
  formData: FormData,
): Promise<ActionState> {
  const petId = String(formData.get("petId") ?? "");
  const pet = await assertOwnership(petId);
  const id = String(formData.get("id") ?? "");

  // Scoped to this pet, so an id from another animal's record does nothing.
  await prisma.allergy.updateMany({
    where: { id, petId: pet.id },
    data: { active: false },
  });

  revalidatePath(`/pets/${pet.id}`);
  return ok;
}

export async function addCondition(
  _previous: ActionState,
  formData: FormData,
): Promise<ActionState> {
  const petId = String(formData.get("petId") ?? "");
  const pet = await assertOwnership(petId);

  const name = String(formData.get("name") ?? "").trim();
  const notes = String(formData.get("notes") ?? "").trim() || null;
  const diagnosedOn = parseOptionalDate(String(formData.get("diagnosedOn") ?? ""));

  if (!name) return fail("Name the condition.");
  if (name.length > 120) return fail("Keep the name short — details go in the notes.");
  if (diagnosedOn === undefined) return fail("Enter a valid date.");
  if (diagnosedOn && diagnosedOn > new Date()) return fail("Date cannot be in the future.");

  await prisma.medicalCondition.create({
    data: { petId: pet.id, name, notes, diagnosedOn },
  });

  revalidatePath(`/pets/${pet.id}`);
  return ok;
}

/** Marks an ongoing condition as resolved today. It stays on the record. */
export async function resolveCondition(
  _previous: ActionState,
  formData: FormData,
): Promise<ActionState> {
  const petId = String(formData.get("petId") ?? "");
  const pet = await assertOwnership(petId);
  const id = String(formData.get("id") ?? "");

  await prisma.medicalCondition.updateMany({
    where: { id, petId: pet.id, resolvedOn: null },
    data: { resolvedOn: new Date() },
  });

  revalidatePath(`/pets/${pet.id}`);
  return ok;
}

/** Deletes a condition outright — for one entered by mistake. */
export async function removeCondition(
  _previous: ActionState,
  formData: FormData,
): Promise<ActionState> {
  const petId = String(formData.get("petId") ?? "");
  const pet = await assertOwnership(petId);
  const id = String(formData.get("id") ?? "");

  await prisma.medicalCondition.deleteMany({ where: { id, petId: pet.id } });

  revalidatePath(`/pets/${pet.id}`);
  return ok;
}
