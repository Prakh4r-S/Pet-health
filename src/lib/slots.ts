import { fromZonedTime, toZonedTime } from "date-fns-tz";
import { prisma } from "@/lib/prisma";

export type Slot = {
  startsAt: Date; // absolute instant, UTC
  endsAt: Date;
};

/** Nothing bookable inside this window — vets need warning. */
const LEAD_TIME_MINUTES = 0;
/** How far ahead slots are offered. */
const HORIZON_DAYS = 14;

/**
 * Generates bookable slots for one vet.
 *
 * The awkward part is that availability is recurring wall-clock time in
 * the vet's own timezone ("Mondays, 09:00–17:00"), while an appointment
 * is an absolute instant. Converting between them has to go through the
 * vet's zone explicitly: 09:00 in Asia/Kolkata is a different instant in
 * June than in December for zones that observe DST, and doing the
 * arithmetic in UTC or in the server's local zone gets it wrong twice a
 * year — quietly, and only for some users.
 */
export async function getAvailableSlots(
  vetProfileId: string,
  { days = HORIZON_DAYS }: { days?: number } = {},
): Promise<Slot[]> {
  const profile = await prisma.vetProfile.findUniqueOrThrow({
    where: { id: vetProfileId },
    include: { availability: true, timeOff: true },
  });

  if (!profile.verifiedAt || !profile.acceptingNewPatients) return [];

  const now = new Date();
  const earliest = new Date(now.getTime() + LEAD_TIME_MINUTES * 60_000);
  const horizon = new Date(now.getTime() + days * 86_400_000);

  // Slots already taken. Cancelled appointments are excluded, so a
  // cancellation frees the slot again.
  const booked = await prisma.appointment.findMany({
    where: {
      vetProfileId,
      status: "SCHEDULED",
      startsAt: { gte: earliest, lte: horizon },
    },
    select: { startsAt: true },
  });
  const takenAt = new Set(booked.map((b) => b.startsAt.getTime()));

  const slots: Slot[] = [];

  for (let dayOffset = 0; dayOffset <= days; dayOffset++) {
    const dayInstant = new Date(now.getTime() + dayOffset * 86_400_000);

    // Which calendar day is it in the *vet's* zone? Near midnight this
    // differs from the server's answer, which is the point of converting.
    const local = toZonedTime(dayInstant, profile.timezone);
    const dayOfWeek = local.getDay();

    const windows = profile.availability.filter((w) => w.dayOfWeek === dayOfWeek);
    if (windows.length === 0) continue;

    const y = local.getFullYear();
    const m = String(local.getMonth() + 1).padStart(2, "0");
    const d = String(local.getDate()).padStart(2, "0");

    for (const window of windows) {
      for (
        let minute = window.startMinute;
        minute + profile.slotMinutes <= window.endMinute;
        minute += profile.slotMinutes
      ) {
        const hh = String(Math.floor(minute / 60)).padStart(2, "0");
        const mm = String(minute % 60).padStart(2, "0");

        // Wall-clock time in the vet's zone -> absolute instant.
        const startsAt = fromZonedTime(`${y}-${m}-${d}T${hh}:${mm}:00`, profile.timezone);
        const endsAt = new Date(startsAt.getTime() + profile.slotMinutes * 60_000);

        if (startsAt < earliest || startsAt > horizon) continue;
        if (takenAt.has(startsAt.getTime())) continue;
        if (isDuringTimeOff(startsAt, endsAt, profile.timeOff)) continue;

        slots.push({ startsAt, endsAt });
      }
    }
  }

  return slots.sort((a, b) => a.startsAt.getTime() - b.startsAt.getTime());
}

function isDuringTimeOff(
  startsAt: Date,
  endsAt: Date,
  timeOff: { startsAt: Date; endsAt: Date }[],
) {
  // Overlap, not containment: a slot that straddles the start of a
  // holiday is still unavailable.
  return timeOff.some((t) => startsAt < t.endsAt && endsAt > t.startsAt);
}

/**
 * Vets who could take an appointment starting now, for the instant-match
 * path. Returns the soonest slot for each, soonest first.
 */
export async function findVetsAvailableNow(specialisationSlug?: string) {
  const vets = await prisma.vetProfile.findMany({
    where: {
      verifiedAt: { not: null },
      acceptingNewPatients: true,
      ...(specialisationSlug
        ? { specialisations: { some: { slug: specialisationSlug } } }
        : {}),
    },
    include: { user: { select: { name: true, image: true } } },
  });

  const results = await Promise.all(
    vets.map(async (vet) => {
      const slots = await getAvailableSlots(vet.id, { days: 1 });
      return slots.length > 0 ? { vet, nextSlot: slots[0] } : null;
    }),
  );

  return results
    .filter((r): r is NonNullable<typeof r> => r !== null)
    .sort((a, b) => a.nextSlot.startsAt.getTime() - b.nextSlot.startsAt.getTime());
}