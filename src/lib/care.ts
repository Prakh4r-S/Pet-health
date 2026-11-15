import { prisma } from "@/lib/prisma";
import { getVaccineStandings } from "@/lib/vaccine-status";
import { dosesPerDay, isPrescriptionCurrent, prescriptionEnd } from "@/lib/prescriptions";

/**
 * What needs doing for a pet now: the medicines it is on, with the log
 * of doses given, and the vaccinations that are overdue or coming up.
 *
 * Everything returned is plain data — ISO strings, no Dates — so the
 * same object serves a server component and a client one.
 */

const DAY_MS = 86_400_000;

/** How long after logging a dose the owner can still take it back. */
export const UNDO_WINDOW_MINUTES = 15;

/** How many past doses the vet is shown per medicine. */
const RECENT_DOSES = 14;

export type CareMedication = {
  prescriptionId: string;
  drug: string;
  dose: string;
  frequency: string;
  instructions: string | null;
  prescribedOn: string;
  /** Last day of the course, or null when the vet gave no duration. */
  until: string | null;
  /** Doses a day the frequency asks for, when it can be read. */
  perDay: number | null;
  givenLast24h: number;
  lastGivenAt: string | null;
  /** Newest first. */
  recentDoses: { id: string; givenAt: string }[];
  /** The newest dose, if it is recent enough for the owner to take back. */
  undoableDoseId: string | null;
};

export type CareVaccine = {
  name: string;
  isCore: boolean;
  status: "OVERDUE" | "DUE_SOON" | "NEVER_GIVEN";
  nextDueOn: string | null;
  daysUntilDue: number | null;
};

export type PetCare = {
  petId: string;
  petName: string;
  medications: CareMedication[];
  vaccines: CareVaccine[];
};

function isMissingTable(error: unknown) {
  return (
    typeof error === "object" && error !== null && "code" in error && error.code === "P2021"
  );
}

/**
 * Doses for a set of prescriptions, newest first.
 *
 * `available: false` means the dose table is not there yet — the code
 * has been deployed ahead of its migration, which a preview build always
 * is. The care summary then shows the medicines without the log rather
 * than taking the whole page down over it.
 */
async function loadDoses(prescriptionIds: string[], since: Date) {
  if (prescriptionIds.length === 0) return { available: true as const, doses: [] };
  try {
    const doses = await prisma.medicationDose.findMany({
      where: { prescriptionId: { in: prescriptionIds }, givenAt: { gte: since } },
      orderBy: { givenAt: "desc" },
      select: { id: true, prescriptionId: true, givenAt: true, loggedById: true },
    });
    return { available: true as const, doses };
  } catch (error) {
    if (isMissingTable(error)) return { available: false as const, doses: [] };
    throw error;
  }
}

/**
 * Care for several pets at once. The caller is responsible for having
 * checked that the viewer may see each of them.
 *
 * `viewerId` decides which doses can be undone: only your own, and only
 * for a few minutes.
 */
export async function getCareForPets(petIds: string[], viewerId: string) {
  if (petIds.length === 0) return { pets: [] as PetCare[], doseLogAvailable: true };
  const now = new Date();

  const [pets, prescriptions] = await Promise.all([
    prisma.pet.findMany({
      where: { id: { in: petIds } },
      select: { id: true, name: true },
      orderBy: { name: "asc" },
    }),
    // Only from notes a vet has finalised: a draft may hold a
    // machine-proposed dose nobody has checked.
    prisma.prescription.findMany({
      where: { petId: { in: petIds }, note: { status: "FINALISED" } },
      orderBy: { createdAt: "desc" },
      select: {
        id: true,
        petId: true,
        drug: true,
        dose: true,
        frequency: true,
        durationDays: true,
        instructions: true,
        createdAt: true,
      },
    }),
  ]);

  const current = prescriptions.filter((p) => isPrescriptionCurrent(p, now));
  // Far enough back to show the vet a fortnight of twice-daily dosing.
  const { available, doses } = await loadDoses(
    current.map((p) => p.id),
    new Date(now.getTime() - 30 * DAY_MS),
  );

  const standings = await Promise.all(
    pets.map(async (pet) => [pet.id, await getVaccineStandings(pet.id)] as const),
  );
  const standingsByPet = new Map(standings);

  const result: PetCare[] = pets.map((pet) => {
    const medications = current
      .filter((p) => p.petId === pet.id)
      .map((p): CareMedication => {
        const mine = doses.filter((d) => d.prescriptionId === p.id);
        const newest = mine[0];
        const undoable =
          newest &&
          newest.loggedById === viewerId &&
          now.getTime() - newest.givenAt.getTime() <= UNDO_WINDOW_MINUTES * 60_000;

        return {
          prescriptionId: p.id,
          drug: p.drug,
          dose: p.dose,
          frequency: p.frequency,
          instructions: p.instructions,
          prescribedOn: p.createdAt.toISOString(),
          until: prescriptionEnd(p)?.toISOString() ?? null,
          perDay: dosesPerDay(p.frequency),
          givenLast24h: mine.filter((d) => now.getTime() - d.givenAt.getTime() <= DAY_MS)
            .length,
          lastGivenAt: newest?.givenAt.toISOString() ?? null,
          recentDoses: mine
            .slice(0, RECENT_DOSES)
            .map((d) => ({ id: d.id, givenAt: d.givenAt.toISOString() })),
          undoableDoseId: undoable ? newest.id : null,
        };
      });

    // Overdue and due-soon whatever the vaccine; never-given only for
    // core ones — an optional vaccine nobody chose is not a to-do.
    const vaccines = (standingsByPet.get(pet.id) ?? [])
      .filter(
        (s) =>
          s.status === "OVERDUE" ||
          s.status === "DUE_SOON" ||
          (s.status === "NEVER_GIVEN" && s.isCore),
      )
      .map(
        (s): CareVaccine => ({
          name: s.name,
          isCore: s.isCore,
          status: s.status as CareVaccine["status"],
          nextDueOn: s.nextDueOn?.toISOString().slice(0, 10) ?? null,
          daysUntilDue: s.daysUntilDue,
        }),
      )
      // Most pressing first.
      .sort((a, b) => urgencyRank(a) - urgencyRank(b));

    return { petId: pet.id, petName: pet.name, medications, vaccines };
  });

  return { pets: result, doseLogAvailable: available };
}

function urgencyRank(v: CareVaccine) {
  if (v.status === "OVERDUE") return -1000 + (v.daysUntilDue ?? 0);
  if (v.status === "NEVER_GIVEN") return 0;
  return 1 + (v.daysUntilDue ?? 0);
}

export function hasCare(pets: PetCare[]) {
  return pets.some((p) => p.medications.length > 0 || p.vaccines.length > 0);
}
