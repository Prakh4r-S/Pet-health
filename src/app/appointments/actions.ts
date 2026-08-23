"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { prisma } from "@/lib/prisma";
import { getCurrentUser } from "@/lib/current-user";
import { getAvailableSlots, findVetsAvailableNow } from "@/lib/slots";

/** Postgres unique-violation code, surfaced by Prisma as P2002. */
const UNIQUE_VIOLATION = "P2002";

export async function bookAppointment(formData: FormData) {
  const user = await getCurrentUser();

  const petId = String(formData.get("petId") ?? "");
  const vetProfileId = String(formData.get("vetProfileId") ?? "");
  const startsAtRaw = String(formData.get("startsAt") ?? "");
  const reason = String(formData.get("reason") ?? "").trim() || null;

  if (!petId || !vetProfileId || !startsAtRaw) throw new Error("Missing details.");

  const startsAt = new Date(startsAtRaw);
  if (Number.isNaN(startsAt.valueOf())) throw new Error("Invalid time.");

  // The pet must belong to the person booking. The id comes from a form
  // field, so this is not a formality.
  const pet = await prisma.pet.findFirst({
    where: { id: petId, ownerId: user.id, archivedAt: null },
    select: { id: true },
  });
  if (!pet) throw new Error("Pet not found.");

  const profile = await prisma.vetProfile.findUniqueOrThrow({
    where: { id: vetProfileId },
    select: { slotMinutes: true },
  });

  // Re-derive the slot list server-side rather than trusting the posted
  // time. Without this, anyone could book 03:00 on a Sunday by editing
  // the form value — the rendered options are a convenience, not a rule.
  const slots = await getAvailableSlots(vetProfileId);
  const isReal = slots.some((s) => s.startsAt.getTime() === startsAt.getTime());
  if (!isReal) throw new Error("That time is no longer available.");

  const endsAt = new Date(startsAt.getTime() + profile.slotMinutes * 60_000);

  try {
    await prisma.appointment.create({
      data: { petId, ownerId: user.id, vetProfileId, startsAt, endsAt, reason },
    });
  } catch (error) {
    // Two people can pass the availability check above at the same time
    // — both read the slot as free before either writes. The partial
    // unique index makes the database reject the second INSERT, and this
    // is where that rejection becomes a sensible message. Checking first
    // and hoping is not a solution to a race; letting the database
    // arbitrate is.
    if (
      typeof error === "object" &&
      error !== null &&
      "code" in error &&
      error.code === UNIQUE_VIOLATION
    ) {
      throw new Error("Someone just booked that slot. Please pick another time.");
    }
    throw error;
  }

  revalidatePath("/appointments");
  redirect("/appointments");
}

export async function bookInstantMatch(formData: FormData) {
  const user = await getCurrentUser();

  const petId = String(formData.get("petId") ?? "");
  const specialisationSlug = String(formData.get("specialisationSlug") ?? "") || undefined;
  const reason = String(formData.get("reason") ?? "").trim() || null;

  const pet = await prisma.pet.findFirst({
    where: { id: petId, ownerId: user.id, archivedAt: null },
    select: { id: true },
  });
  if (!pet) throw new Error("Pet not found.");

  const candidates = await findVetsAvailableNow(specialisationSlug);
  if (candidates.length === 0) {
    throw new Error("No vets are available right now. Try booking a specific time.");
  }

  // Walk the candidates in order rather than committing to the first.
  // If someone takes the soonest slot between our read and our write,
  // the next vet is tried instead of failing the whole request.
  for (const { vet, nextSlot } of candidates) {
    try {
      await prisma.appointment.create({
        data: {
          petId,
          ownerId: user.id,
          vetProfileId: vet.id,
          startsAt: nextSlot.startsAt,
          endsAt: nextSlot.endsAt,
          reason,
          wasInstantMatch: true,
        },
      });
      revalidatePath("/appointments");
      redirect("/appointments");
    } catch (error) {
      // redirect() throws by design — let it through.
      if (typeof error === "object" && error !== null && "digest" in error) throw error;
      if (
        typeof error === "object" &&
        error !== null &&
        "code" in error &&
        error.code === UNIQUE_VIOLATION
      ) {
        continue;
      }
      throw error;
    }
  }

  throw new Error("Those slots were taken while booking. Please try again.");
}

export async function cancelAppointment(formData: FormData) {
  const user = await getCurrentUser();
  const id = String(formData.get("id") ?? "");

  const appointment = await prisma.appointment.findUnique({
    where: { id },
    include: { vetProfile: { select: { userId: true } } },
  });
  if (!appointment) throw new Error("Appointment not found.");

  // Either party may cancel, nobody else.
  const isOwner = appointment.ownerId === user.id;
  const isVet = appointment.vetProfile.userId === user.id;
  if (!isOwner && !isVet) throw new Error("Not your appointment.");

  await prisma.appointment.update({
    where: { id },
    data: { status: "CANCELLED", cancelledAt: new Date(), cancelledBy: user.id },
  });

  revalidatePath("/appointments");
  revalidatePath("/vet/appointments");
}