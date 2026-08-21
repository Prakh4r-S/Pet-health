"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { prisma } from "@/lib/prisma";
import { getCurrentUser, requireVetProfile } from "@/lib/current-user";

export async function createVetProfile(formData: FormData) {
  const user = await getCurrentUser();

  const licenceNumber = String(formData.get("licenceNumber") ?? "").trim();
  const clinicName = String(formData.get("clinicName") ?? "").trim() || null;
  const city = String(formData.get("city") ?? "").trim() || null;
  const bio = String(formData.get("bio") ?? "").trim() || null;
  const yearsRaw = String(formData.get("yearsExperience") ?? "");
  const slotMinutes = Number(formData.get("slotMinutes") ?? 30);
  const specialisationIds = formData.getAll("specialisationIds").map(String);

  if (!licenceNumber) throw new Error("Licence number is required.");
  if (![15, 20, 30, 45, 60].includes(slotMinutes)) {
    throw new Error("Invalid appointment length.");
  }

  const years = yearsRaw ? Number(yearsRaw) : null;
  if (years !== null && (!Number.isInteger(years) || years < 0 || years > 70)) {
    throw new Error("Years of experience looks wrong.");
  }

  // Role and profile are written together. If the profile insert failed
  // after the role update, the user would be a VET with nothing to show
  // — a transaction makes the pair atomic.
  await prisma.$transaction([
    prisma.user.update({ where: { id: user.id }, data: { role: "VET" } }),
    prisma.vetProfile.create({
      data: {
        userId: user.id,
        licenceNumber,
        clinicName,
        city,
        bio,
        yearsExperience: years,
        slotMinutes,
        specialisations: { connect: specialisationIds.map((id) => ({ id })) },
        // Auto-verified for this build. A real product would hold this
        // null until the licence number is checked against a register.
        verifiedAt: new Date(),
      },
    }),
  ]);

  redirect("/vet/availability");
}

export async function addAvailability(formData: FormData) {
  const { profile } = await requireVetProfile();

  const dayOfWeek = Number(formData.get("dayOfWeek"));
  const startMinute = toMinutes(String(formData.get("startTime") ?? ""));
  const endMinute = toMinutes(String(formData.get("endTime") ?? ""));

  if (!Number.isInteger(dayOfWeek) || dayOfWeek < 0 || dayOfWeek > 6) {
    throw new Error("Pick a day.");
  }
  if (startMinute === null || endMinute === null) throw new Error("Enter both times.");
  if (endMinute <= startMinute) throw new Error("End time must be after start time.");
  if (endMinute - startMinute < profile.slotMinutes) {
    throw new Error(`Window is shorter than one ${profile.slotMinutes}-minute appointment.`);
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
}

export async function removeAvailability(formData: FormData) {
  const { profile } = await requireVetProfile();
  const id = String(formData.get("id") ?? "");

  // Scoped to this vet's profile id — deleting by id alone would let one
  // vet remove another's availability by posting a guessed id.
  await prisma.vetAvailability.deleteMany({
    where: { id, vetProfileId: profile.id },
  });

  revalidatePath("/vet/availability");
}

export async function addTimeOff(formData: FormData) {
  const { profile } = await requireVetProfile();

  const startsAt = new Date(String(formData.get("startsAt") ?? ""));
  const endsAt = new Date(String(formData.get("endsAt") ?? ""));
  const reason = String(formData.get("reason") ?? "").trim() || null;

  if (Number.isNaN(startsAt.valueOf()) || Number.isNaN(endsAt.valueOf())) {
    throw new Error("Enter both dates.");
  }
  if (endsAt <= startsAt) throw new Error("End must be after start.");

  await prisma.vetTimeOff.create({
    data: { vetProfileId: profile.id, startsAt, endsAt, reason },
  });

  revalidatePath("/vet/availability");
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