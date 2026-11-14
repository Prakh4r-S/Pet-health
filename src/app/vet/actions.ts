"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { prisma } from "@/lib/prisma";
import { getCurrentUser, requireVetProfile } from "@/lib/current-user";
import { fromZonedTime } from "date-fns-tz";
import { fail, isUniqueViolation, ok, type ActionState } from "@/lib/action-result";
import {
  DEFAULT_TIMEZONE,
  isCalendarDate,
  isValidTimezone,
  nextCalendarDay,
} from "@/lib/timezones";
import { parseVetDetails } from "@/lib/vet-profile-input";
import { parseImageField } from "@/lib/upload-rules";

export async function createVetProfile(
  _previous: ActionState,
  formData: FormData,
): Promise<ActionState> {
  const user = await getCurrentUser();

  const parsed = parseVetDetails(formData);
  if ("error" in parsed) return fail(parsed.error);

  const slotMinutes = Number(formData.get("slotMinutes") ?? 30);
  const specialisationIds = formData.getAll("specialisationIds").map(String);
  const timezone = String(formData.get("timezone") ?? "") || DEFAULT_TIMEZONE;

  // Availability is stored as wall-clock hours in this zone, so a wrong
  // or unusable value here would shift every slot the vet ever offers.
  if (!isValidTimezone(timezone)) return fail("Choose a timezone from the list.");
  if (![15, 20, 30, 45, 60].includes(slotMinutes)) {
    return fail("Choose an appointment length.");
  }

  // Only ids that exist are connected; an unknown one would otherwise
  // fail the whole insert.
  const specialisations = await prisma.specialisation.findMany({
    where: { id: { in: specialisationIds } },
    select: { id: true },
  });

  // Role and profile are written together. If the profile insert failed
  // after the role update, the user would be a VET with nothing to show
  // — a transaction makes the pair atomic.
  try {
    await prisma.$transaction([
      prisma.user.update({ where: { id: user.id }, data: { role: "VET" } }),
      prisma.vetProfile.create({
        data: {
          userId: user.id,
          ...parsed.details,
          slotMinutes,
          timezone,
          specialisations: { connect: specialisations },
          // Auto-verified for this build. A real product would hold this
          // null until the licence number is checked against a register.
          verifiedAt: new Date(),
        },
      }),
    ]);
  } catch (error) {
    // userId is unique: a second submission finds the profile already
    // there, which is the outcome that was asked for.
    if (!isUniqueViolation(error)) throw error;
  }

  redirect("/vet/availability");
}

/**
 * Saves the vet's own practitioner and clinic profile.
 *
 * Everything an owner reads before booking is edited here. Timezone and
 * appointment length are not: both change what the existing weekly hours
 * mean, and belong with the availability they define.
 */
export async function updateVetProfile(
  _previous: ActionState,
  formData: FormData,
): Promise<ActionState> {
  const { user, profile } = await requireVetProfile();

  const parsed = parseVetDetails(formData);
  if ("error" in parsed) return fail(parsed.error);

  const name = String(formData.get("name") ?? "").trim();
  if (!name) return fail("Display name is required. Owners book you by it.");
  if (name.length > 80) return fail("That name is too long.");

  const avatarUrl = parseImageField(formData.get("avatarUrl"));
  const clinicImageUrl = parseImageField(formData.get("clinicImageUrl"));
  if (avatarUrl === false || clinicImageUrl === false) {
    return fail("That photo could not be used. Upload it again.");
  }

  const specialisations = await prisma.specialisation.findMany({
    where: { id: { in: formData.getAll("specialisationIds").map(String) } },
    select: { id: true },
  });

  // The display name lives on the account, the rest on the profile;
  // written together so a failure cannot save half of the form.
  await prisma.$transaction([
    prisma.user.update({ where: { id: user.id }, data: { name } }),
    prisma.vetProfile.update({
      where: { id: profile.id },
      data: {
        ...parsed.details,
        avatarUrl,
        clinicImageUrl,
        acceptingNewPatients: formData.get("acceptingNewPatients") === "on",
        specialisations: { set: specialisations },
      },
    }),
  ]);

  revalidatePath("/vet/profile");
  revalidatePath("/vets");
  revalidatePath(`/vets/${profile.id}`);
  return ok;
}

export async function addAvailability(
  _previous: ActionState,
  formData: FormData,
): Promise<ActionState> {
  const { profile } = await requireVetProfile();

  const dayOfWeek = Number(formData.get("dayOfWeek"));
  const startMinute = toMinutes(String(formData.get("startTime") ?? ""));
  const endMinute = toMinutes(String(formData.get("endTime") ?? ""));

  if (!Number.isInteger(dayOfWeek) || dayOfWeek < 0 || dayOfWeek > 6) {
    return fail("Pick a day.");
  }
  if (startMinute === null || endMinute === null) return fail("Enter both times.");
  if (endMinute <= startMinute) return fail("End time must be after start time.");
  if (endMinute - startMinute < profile.slotMinutes) {
    return fail(`That window is shorter than one ${profile.slotMinutes}-minute appointment.`);
  }

  // Overlapping windows on the same day would generate duplicate slots,
  // so merge into the existing window rather than stacking a second one.
  const existing = await prisma.vetAvailability.findMany({
    where: { vetProfileId: profile.id, dayOfWeek },
  });

  const overlapping = existing.filter(
    (w) => startMinute <= w.endMinute && endMinute >= w.startMinute,
  );

  if (overlapping.length > 0) {
    const mergedStart = Math.min(startMinute, ...overlapping.map((w) => w.startMinute));
    const mergedEnd = Math.max(endMinute, ...overlapping.map((w) => w.endMinute));

    await prisma.$transaction([
      prisma.vetAvailability.deleteMany({
        where: { id: { in: overlapping.map((w) => w.id) } },
      }),
      prisma.vetAvailability.create({
        data: { vetProfileId: profile.id, dayOfWeek, startMinute: mergedStart, endMinute: mergedEnd },
      }),
    ]);
  } else {
    await prisma.vetAvailability.create({
      data: { vetProfileId: profile.id, dayOfWeek, startMinute, endMinute },
    });
  }

  revalidatePath("/vet/availability");
  return ok;
}

export async function removeAvailability(
  _previous: ActionState,
  formData: FormData,
): Promise<ActionState> {
  const { profile } = await requireVetProfile();
  const id = String(formData.get("id") ?? "");

  // Scoped to this vet's profile id — deleting by id alone would let one
  // vet remove another's availability by posting a guessed id.
  await prisma.vetAvailability.deleteMany({
    where: { id, vetProfileId: profile.id },
  });

  revalidatePath("/vet/availability");
  return ok;
}

export async function removeTimeOff(
  _previous: ActionState,
  formData: FormData,
): Promise<ActionState> {
  const { profile } = await requireVetProfile();
  const id = String(formData.get("id") ?? "");

  // Scoped to this vet's profile, as with availability above.
  await prisma.vetTimeOff.deleteMany({
    where: { id, vetProfileId: profile.id },
  });

  revalidatePath("/vet/availability");
  return ok;
}

export async function addTimeOff(
  _previous: ActionState,
  formData: FormData,
): Promise<ActionState> {
  const { profile } = await requireVetProfile();

  const from = String(formData.get("startsAt") ?? "");
  const to = String(formData.get("endsAt") ?? "");
  const reason = String(formData.get("reason") ?? "").trim() || null;

  if (!isCalendarDate(from) || !isCalendarDate(to)) return fail("Enter both dates.");
  // ISO dates sort as text, so this is a date comparison.
  if (to < from) return fail("The last day can't be before the first day.");

  // The form asks for days, and a day off means the vet's day: midnight
  // to midnight where they are, not in UTC. For a vet in Kolkata the two
  // differ by five and a half hours, which is the difference between a
  // morning clinic being blocked or left open for booking.
  //
  // Both days are inclusive — "10th to 10th" is the whole of the 10th —
  // so the stored end is the start of the day after the last one. Going
  // through the zone rather than adding 24 hours keeps that right on the
  // days a clock change makes 23 or 25 hours long.
  const startsAt = fromZonedTime(`${from}T00:00:00`, profile.timezone);
  const endsAt = fromZonedTime(`${nextCalendarDay(to)}T00:00:00`, profile.timezone);

  await prisma.vetTimeOff.create({
    data: { vetProfileId: profile.id, startsAt, endsAt, reason },
  });

  revalidatePath("/vet/availability");
  return ok;
}

/** "09:30" -> 570. Returns null on anything unparseable. */
function toMinutes(value: string): number | null {
  const match = /^(\d{1,2}):(\d{2})$/.exec(value);
  if (!match) return null;
  const h = Number(match[1]);
  const m = Number(match[2]);
  if (h > 23 || m > 59) return null;
  return h * 60 + m;
}