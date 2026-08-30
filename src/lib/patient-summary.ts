import { prisma } from "@/lib/prisma";
import { getVaccineStandings } from "@/lib/vaccine-status";

/**
 * A plain-object summary of a pet's records, safe to hand to a client
 * component.
 *
 * Prisma returns Decimal instances and Date objects, neither of which
 * survives serialisation across the server/client boundary intact. They
 * are converted to numbers and ISO strings here, once, rather than being
 * dealt with ad hoc in the UI.
 */
export type PatientSummary = {
  id: string;
  name: string;
  species: string;
  breed: string | null;
  sex: string;
  ageMonths: number | null;
  ageIsApprox: boolean;
  neutered: boolean | null;
  latestWeightKg: number | null;
  weights: { date: string; weightKg: number }[];
  allergies: { allergen: string; reaction: string | null; severity: string }[];
  conditions: { name: string; notes: string | null; ongoing: boolean }[];
  vaccines: {
    name: string;
    isCore: boolean;
    status: string;
    lastGivenOn: string | null;
    nextDueOn: string | null;
  }[];
  documents: {
    id: string;
    kind: string;
    title: string;
    createdAt: string;
  }[];
};

function monthsSince(birthDate: Date | null): number | null {
  if (!birthDate) return null;
  const now = new Date();
  let months =
    (now.getFullYear() - birthDate.getFullYear()) * 12 +
    (now.getMonth() - birthDate.getMonth());
  if (now.getDate() < birthDate.getDate()) months -= 1;
  return months < 0 ? null : months;
}

export async function getPatientSummary(petId: string): Promise<PatientSummary> {
  const pet = await prisma.pet.findUniqueOrThrow({
    where: { id: petId },
    include: {
      species: { select: { name: true } },
      breed: { select: { name: true } },
      weights: { orderBy: { measuredAt: "asc" } },
      allergies: { where: { active: true } },
      conditions: { orderBy: { diagnosedOn: "desc" } },
      documents: { orderBy: { createdAt: "desc" }, take: 20 },
    },
  });

  const standings = await getVaccineStandings(petId);
  const latest = pet.weights.at(-1);

  return {
    id: pet.id,
    name: pet.name,
    species: pet.species.name,
    breed: pet.breed?.name ?? pet.breedFreeText ?? null,
    sex: pet.sex,
    ageMonths: monthsSince(pet.birthDate),
    ageIsApprox: pet.birthDateIsApprox,
    neutered: pet.neutered,
    latestWeightKg: latest ? Number(latest.weightKg) : null,
    weights: pet.weights.map((w) => ({
      date: w.measuredAt.toISOString().slice(0, 10),
      weightKg: Number(w.weightKg),
    })),
    allergies: pet.allergies.map((a) => ({
      allergen: a.allergen,
      reaction: a.reaction,
      severity: a.severity,
    })),
    conditions: pet.conditions.map((c) => ({
      name: c.name,
      notes: c.notes,
      ongoing: c.resolvedOn === null,
    })),
    vaccines: standings.map((s) => ({
      name: s.name,
      isCore: s.isCore,
      status: s.status,
      lastGivenOn: s.lastGivenOn?.toISOString().slice(0, 10) ?? null,
      nextDueOn: s.nextDueOn?.toISOString().slice(0, 10) ?? null,
    })),
    documents: pet.documents.map((d) => ({
      id: d.id,
      kind: d.kind,
      title: d.title,
      createdAt: d.createdAt.toISOString().slice(0, 10),
    })),
  };
}
