import { randomBytes } from "node:crypto";
import { prisma } from "@/lib/prisma";
import { getVaccineStandings } from "@/lib/vaccine-status";

/** 32 random bytes: unguessable, and short enough to sit in a URL. */
export function newPassportToken() {
  return randomBytes(32).toString("base64url");
}

/** Tokens are always this shape; anything else is not worth a query. */
const TOKEN_PATTERN = /^[A-Za-z0-9_-]{43}$/;

/**
 * A prescription with no stated duration is treated as current for this
 * long after it was written. Without a cut-off, a one-off course whose
 * length the vet never recorded would be listed as "current medication"
 * for the rest of the animal's life.
 */
const OPEN_ENDED_PRESCRIPTION_DAYS = 90;

const DAY_MS = 86_400_000;

function isoDate(d: Date | null) {
  return d ? d.toISOString().slice(0, 10) : null;
}

function monthsSince(birthDate: Date | null): number | null {
  if (!birthDate) return null;
  const now = new Date();
  let months =
    (now.getFullYear() - birthDate.getFullYear()) * 12 +
    (now.getMonth() - birthDate.getMonth());
  if (now.getDate() < birthDate.getDate()) months -= 1;
  return months < 0 ? null : months;
}

/**
 * The share link for a pet, as the owner's page needs it.
 *
 * `available: false` means the table is not there — the code has been
 * deployed ahead of its migration. The pet page carries on without the
 * sharing card rather than failing outright over an optional feature.
 */
export async function getPassportForPet(petId: string) {
  try {
    const passport = await prisma.petPassport.findUnique({
      where: { petId },
      select: { token: true, contactNote: true, createdAt: true },
    });
    return { available: true as const, passport };
  } catch (error) {
    if (typeof error === "object" && error !== null && "code" in error && error.code === "P2021") {
      return { available: false as const, passport: null };
    }
    throw error;
  }
}

export type PassportView = NonNullable<Awaited<ReturnType<typeof getPassportView>>>;

/**
 * Everything the public passport page shows, and nothing else.
 *
 * This function is the access control for that page: there is no session
 * to check, so what a stranger holding the link can learn is exactly
 * what is selected here. It is built field by field for that reason —
 * no record is passed through whole — and it leaves out, deliberately:
 *
 *   - documents, snapshots and recordings
 *   - consultation notes, transcripts and amendments
 *   - the owner's email address and anything else from their account
 *   - appointments, and which vet was seen
 *   - allergies marked inactive, and conditions that have resolved
 *
 * Prescriptions come only from notes a vet has finalised. A draft may
 * hold a machine-proposed dose nobody has checked, and a sitter acting
 * on that is the worst outcome this page could have.
 */
export async function getPassportView(token: string) {
  if (!TOKEN_PATTERN.test(token)) return null;

  const passport = await prisma.petPassport.findUnique({
    where: { token },
    select: {
      contactNote: true,
      updatedAt: true,
      pet: {
        select: {
          id: true,
          archivedAt: true,
          name: true,
          sex: true,
          birthDate: true,
          birthDateIsApprox: true,
          neutered: true,
          microchipNumber: true,
          breedFreeText: true,
          species: { select: { name: true } },
          breed: { select: { name: true } },
          owner: { select: { name: true } },
          weights: {
            orderBy: { measuredAt: "desc" },
            take: 1,
            select: { weightKg: true, measuredAt: true },
          },
          allergies: {
            where: { active: true },
            orderBy: { createdAt: "asc" },
            select: { allergen: true, reaction: true, severity: true },
          },
          conditions: {
            where: { resolvedOn: null },
            orderBy: { createdAt: "asc" },
            select: { name: true, notes: true, diagnosedOn: true },
          },
          prescriptions: {
            where: { note: { status: "FINALISED" } },
            orderBy: { createdAt: "desc" },
            select: {
              drug: true,
              dose: true,
              frequency: true,
              durationDays: true,
              instructions: true,
              createdAt: true,
            },
          },
        },
      },
    },
  });

  // An archived pet's link stops working, as the owner's own page does.
  if (!passport || passport.pet.archivedAt) return null;

  const { pet } = passport;
  const now = Date.now();

  const prescriptions = pet.prescriptions.flatMap((p) => {
    const started = p.createdAt.getTime();
    const until = p.durationDays != null ? new Date(started + p.durationDays * DAY_MS) : null;
    const current = until
      ? until.getTime() >= now
      : now - started <= OPEN_ENDED_PRESCRIPTION_DAYS * DAY_MS;

    return current
      ? [
          {
            drug: p.drug,
            dose: p.dose,
            frequency: p.frequency,
            instructions: p.instructions,
            prescribedOn: isoDate(p.createdAt)!,
            until: isoDate(until),
          },
        ]
      : [];
  });

  const standings = await getVaccineStandings(pet.id);
  const latestWeight = pet.weights[0];

  return {
    name: pet.name,
    species: pet.species.name,
    breed: pet.breed?.name ?? pet.breedFreeText ?? null,
    sex: pet.sex,
    neutered: pet.neutered,
    microchipNumber: pet.microchipNumber,
    birthDate: isoDate(pet.birthDate),
    birthDateIsApprox: pet.birthDateIsApprox,
    ageMonths: monthsSince(pet.birthDate),
    weight: latestWeight
      ? { kg: Number(latestWeight.weightKg), measuredOn: isoDate(latestWeight.measuredAt)! }
      : null,
    allergies: pet.allergies,
    conditions: pet.conditions.map((c) => ({
      name: c.name,
      notes: c.notes,
      diagnosedOn: isoDate(c.diagnosedOn),
    })),
    prescriptions,
    vaccines: standings.map((s) => ({
      name: s.name,
      isCore: s.isCore,
      status: s.status,
      lastGivenOn: isoDate(s.lastGivenOn),
      nextDueOn: isoDate(s.nextDueOn),
    })),
    ownerName: pet.owner.name,
    contactNote: passport.contactNote,
    updatedOn: isoDate(new Date())!,
  };
}
