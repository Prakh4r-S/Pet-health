import { prisma } from "@/lib/prisma";

export type VaccineStatus = "NEVER_GIVEN" | "OVERDUE" | "DUE_SOON" | "UP_TO_DATE";

export type VaccineStanding = {
  vaccineTypeId: string;
  name: string;
  isCore: boolean;
  status: VaccineStatus;
  lastGivenOn: Date | null;
  nextDueOn: Date | null;
  daysUntilDue: number | null;
};

const DUE_SOON_DAYS = 30;

function daysBetween(from: Date, to: Date) {
  const ms = to.setHours(0, 0, 0, 0) - from.setHours(0, 0, 0, 0);
  return Math.round(ms / 86_400_000);
}

/**
 * Builds the vaccination picture for one pet.
 *
 * The important case is NEVER_GIVEN. Querying only on `nextDueOn` finds
 * vaccines that are lapsing, but a vaccine that was never administered
 * has no row at all — so a pure query reports "nothing due" for a pet
 * that has had no vaccinations whatsoever. Starting from the species'
 * core vaccine list and looking for gaps is what catches that.
 */
export async function getVaccineStandings(petId: string): Promise<VaccineStanding[]> {
  const pet = await prisma.pet.findUniqueOrThrow({
    where: { id: petId },
    select: { speciesId: true },
  });

  // Every vaccine defined for this species — the checklist we measure against.
  const types = await prisma.vaccineType.findMany({
    where: { speciesId: pet.speciesId },
    orderBy: [{ isCore: "desc" }, { name: "asc" }],
  });

  // Most recent administration per vaccine type.
  const records = await prisma.vaccination.findMany({
    where: { petId },
    orderBy: { administeredOn: "desc" },
  });

  const latest = new Map<string, (typeof records)[number]>();
  for (const r of records) {
    if (!latest.has(r.vaccineTypeId)) latest.set(r.vaccineTypeId, r);
  }

  const today = new Date();

  return types.map((type): VaccineStanding => {
    const record = latest.get(type.id);

    if (!record) {
      return {
        vaccineTypeId: type.id,
        name: type.name,
        isCore: type.isCore,
        status: "NEVER_GIVEN",
        lastGivenOn: null,
        nextDueOn: null,
        daysUntilDue: null,
      };
    }

    // A single-dose vaccine (no interval) never falls due again.
    if (!record.nextDueOn) {
      return {
        vaccineTypeId: type.id,
        name: type.name,
        isCore: type.isCore,
        status: "UP_TO_DATE",
        lastGivenOn: record.administeredOn,
        nextDueOn: null,
        daysUntilDue: null,
      };
    }

    const days = daysBetween(new Date(today), new Date(record.nextDueOn));
    const status: VaccineStatus =
      days < 0 ? "OVERDUE" : days <= DUE_SOON_DAYS ? "DUE_SOON" : "UP_TO_DATE";

    return {
      vaccineTypeId: type.id,
      name: type.name,
      isCore: type.isCore,
      status,
      lastGivenOn: record.administeredOn,
      nextDueOn: record.nextDueOn,
      daysUntilDue: days,
    };
  });
}
