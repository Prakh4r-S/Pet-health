"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { prisma } from "@/lib/prisma";
import { getCurrentUser } from "@/lib/current-user";
import { getAvailableSlots, findVetsAvailableNow } from "@/lib/slots";
import { fail, isUniqueViolation, ok, type ActionState } from "@/lib/action-result";
import { intakeToAppointmentData, parseIntake } from "@/lib/visit-intake";

export async function bookAppointment(
  _previous: ActionState,
  formData: FormData,
): Promise<ActionState> {
  const user = await getCurrentUser();

  const petId = String(formData.get("petId") ?? "");
  const vetProfileId = String(formData.get("vetProfileId") ?? "");
  const startsAtRaw = String(formData.get("startsAt") ?? "");

  if (!petId) return fail("Choose a pet.");
  if (!vetProfileId || !startsAtRaw) return fail("Pick a time first.");

  const parsed = parseIntake(formData);
  if (!parsed.ok) return fail(parsed.error);
  const intake = intakeToAppointmentData(parsed.intake);

  const startsAt = new Date(startsAtRaw);
  if (Number.isNaN(startsAt.valueOf())) return fail("Pick a time first.");

  // The pet must belong to the person booking. The id comes from a form
  // field, so this is not a formality.
  const pet = await prisma.pet.findFirst({
    where: { id: petId, ownerId: user.id, archivedAt: null },
    select: { id: true },
  });
  if (!pet) return fail("Choose one of your pets.");

  const profile = await prisma.vetProfile.findUnique({
    where: { id: vetProfileId },
    select: { slotMinutes: true },
  });
  if (!profile) return fail("That vet is no longer available.");

  // Re-derive the slot list server-side rather than trusting the posted
  // time. Without this, anyone could book 03:00 on a Sunday by editing
  // the form value — the rendered options are a convenience, not a rule.
  const slots = await getAvailableSlots(vetProfileId);
  const isReal = slots.some((s) => s.startsAt.getTime() === startsAt.getTime());
  if (!isReal) return fail("That time is no longer available. Please pick another.");

  const endsAt = new Date(startsAt.getTime() + profile.slotMinutes * 60_000);

  try {
    await prisma.appointment.create({
      data: { petId, ownerId: user.id, vetProfileId, startsAt, endsAt, ...intake },
    });
  } catch (error) {
    // Two people can pass the availability check above at the same time
    // — both read the slot as free before either writes. The partial
    // unique index makes the database reject the second INSERT, and this
    // is where that rejection becomes a sensible message. Checking first
    // and hoping is not a solution to a race; letting the database
    // arbitrate is.
    if (isUniqueViolation(error)) {
      return fail("Someone just booked that slot. Please pick another time.");
    }
    throw error;
  }

  revalidatePath("/appointments");
  redirect("/appointments");
}

export async function bookInstantMatch(
  _previous: ActionState,
  formData: FormData,
): Promise<ActionState> {
  const user = await getCurrentUser();

  const petId = String(formData.get("petId") ?? "");
  const specialisationSlug = String(formData.get("specialisationSlug") ?? "") || undefined;

  if (!petId) return fail("Choose a pet.");
  const parsed = parseIntake(formData);
  if (!parsed.ok) return fail(parsed.error);
  const intake = intakeToAppointmentData(parsed.intake);

  const pet = await prisma.pet.findFirst({
    where: { id: petId, ownerId: user.id, archivedAt: null },
    select: { id: true },
  });
  if (!pet) return fail("Choose one of your pets.");

  const candidates = await findVetsAvailableNow(specialisationSlug);
  if (candidates.length === 0) {
    return fail("No vets have an opening in the next 24 hours. Try booking a specific time.");
  }

  // Walk the candidates in order rather than committing to the first.
  // If someone takes the soonest slot between our read and our write,
  // the next vet is tried instead of failing the whole request.
  let booked = false;
  for (const { vet, nextSlot } of candidates) {
    try {
      await prisma.appointment.create({
        data: {
          petId,
          ownerId: user.id,
          vetProfileId: vet.id,
          startsAt: nextSlot.startsAt,
          endsAt: nextSlot.endsAt,
          ...intake,
          wasInstantMatch: true,
        },
      });
      booked = true;
      break;
    } catch (error) {
      if (isUniqueViolation(error)) continue;
      throw error;
    }
  }

  if (!booked) return fail("Those slots were taken while booking. Please try again.");

  // Outside the try: redirect() works by throwing, and should not have to
  // be picked back out of a catch block.
  revalidatePath("/appointments");
  redirect("/appointments");
}

export async function cancelAppointment(
  _previous: ActionState,
  formData: FormData,
): Promise<ActionState> {
  const user = await getCurrentUser();
  const id = String(formData.get("id") ?? "");

  const appointment = await prisma.appointment.findUnique({
    where: { id },
    include: { vetProfile: { select: { userId: true } } },
  });
  if (!appointment) return fail("Appointment not found.");

  // Either party may cancel, nobody else.
  const isOwner = appointment.ownerId === user.id;
  const isVet = appointment.vetProfile.userId === user.id;
  if (!isOwner && !isVet) return fail("Appointment not found.");

  // Only an appointment that has not happened yet can be cancelled.
  // A vet's access to a patient's records hangs on the appointment's
  // status, so cancelling one that already took place would take away
  // their access to a case they treated — and rewrite what happened.
  const now = new Date();
  const cancellable = { id, status: "SCHEDULED", startsAt: { gt: now } } as const;

  // The condition is part of the write, not a check before it: between
  // reading the row above and updating it, the vet may have finalised
  // the record, and that must win.
  const { count } = await prisma.appointment.updateMany({
    where: cancellable,
    data: { status: "CANCELLED", cancelledAt: now, cancelledBy: user.id },
  });

  if (count === 0) {
    const current = await prisma.appointment.findUnique({
      where: { id },
      select: { status: true },
    });
    if (current?.status === "CANCELLED") {
      return fail("This appointment has already been cancelled.");
    }
    if (current?.status === "COMPLETED") {
      return fail("This consultation is complete and can no longer be cancelled.");
    }
    return fail("This appointment has already started and can no longer be cancelled.");
  }

  revalidatePath("/appointments");
  revalidatePath("/vet/appointments");
  return ok;
}

/**
 * Moves an upcoming appointment to another of the same vet's open slots.
 *
 * The appointment is updated in place rather than cancelled and booked
 * again: it keeps its id — so the room link, and any calendar entry made
 * from it, still point at the right thing — and it keeps the pre-visit
 * brief, which is the point. Owner only; a vet who cannot make a time
 * cancels, so that the owner chooses the new one.
 */
export async function rescheduleAppointment(
  _previous: ActionState,
  formData: FormData,
): Promise<ActionState> {
  const user = await getCurrentUser();
  const id = String(formData.get("id") ?? "");
  const startsAtRaw = String(formData.get("startsAt") ?? "");

  const startsAt = new Date(startsAtRaw);
  if (!startsAtRaw || Number.isNaN(startsAt.valueOf())) return fail("Pick a new time first.");

  const appointment = await prisma.appointment.findFirst({
    where: { id, ownerId: user.id },
    select: {
      id: true,
      status: true,
      startsAt: true,
      vetProfileId: true,
      vetProfile: { select: { slotMinutes: true } },
    },
  });
  if (!appointment) return fail("Appointment not found.");

  const now = new Date();
  if (appointment.status !== "SCHEDULED" || appointment.startsAt <= now) {
    return fail("This appointment has already started or ended and can no longer be moved.");
  }
  if (appointment.startsAt.getTime() === startsAt.getTime()) {
    return fail("That is the time it is already booked for.");
  }

  // As with booking: the posted time is checked against the slots the
  // server itself generates, not trusted.
  const slots = await getAvailableSlots(appointment.vetProfileId);
  if (!slots.some((s) => s.startsAt.getTime() === startsAt.getTime())) {
    return fail("That time is no longer available. Please pick another.");
  }

  const endsAt = new Date(startsAt.getTime() + appointment.vetProfile.slotMinutes * 60_000);

  // The conditions are part of the write, so an appointment cancelled or
  // started in the meantime is left alone. Two owners after the same slot
  // are settled by the same unique index that settles two bookings.
  let moved: number;
  try {
    ({ count: moved } = await prisma.appointment.updateMany({
      where: { id: appointment.id, status: "SCHEDULED", startsAt: { gt: now } },
      data: { startsAt, endsAt },
    }));
  } catch (error) {
    if (isUniqueViolation(error)) {
      return fail("Someone just booked that slot. Please pick another time.");
    }
    throw error;
  }
  if (moved === 0) {
    return fail("This appointment has already started or ended and can no longer be moved.");
  }

  revalidatePath("/appointments");
  revalidatePath("/vet/appointments");
  redirect("/appointments?rescheduled=1");
}
