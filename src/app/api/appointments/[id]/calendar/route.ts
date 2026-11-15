import { NextResponse } from "next/server";
import { auth } from "@/../auth";
import { prisma } from "@/lib/prisma";
import { buildCalendarFile } from "@/lib/ics";
import { JOIN_WINDOW_BEFORE_MINUTES } from "@/lib/consultation-room";

/**
 * A calendar file for one appointment, for the owner or the vet on it.
 *
 * A route rather than a file built in the browser, so the link works as
 * a plain download with no script, and so the event's address is worked
 * out from the request that asked for it.
 *
 * The file carries the pet's name and the vet's and a link to the call —
 * and nothing clinical. The reason for the visit is left out: a calendar
 * entry is synced to other devices and shown on lock screens.
 */
export async function GET(
  request: Request,
  { params }: { params: Promise<{ id: string }> },
) {
  const session = await auth();
  if (!session?.user?.id) {
    return NextResponse.json({ error: "Not signed in" }, { status: 401 });
  }
  const userId = session.user.id;
  const { id } = await params;

  // The id and the caller are checked in one query: an appointment that
  // is not theirs is indistinguishable from one that does not exist.
  const appointment = await prisma.appointment.findFirst({
    where: {
      id,
      status: "SCHEDULED",
      OR: [{ ownerId: userId }, { vetProfile: { userId } }],
    },
    select: {
      id: true,
      startsAt: true,
      endsAt: true,
      updatedAt: true,
      pet: { select: { name: true } },
      vetProfile: { select: { clinicName: true, user: { select: { name: true } } } },
    },
  });
  if (!appointment) {
    return NextResponse.json({ error: "Appointment not found" }, { status: 404 });
  }

  const origin = new URL(request.url).origin;
  const roomUrl = `${origin}/appointments/${appointment.id}/room`;
  const vetName = appointment.vetProfile.user.name ?? "your vet";
  const clinic = appointment.vetProfile.clinicName;

  const file = buildCalendarFile({
    uid: `appointment-${appointment.id}@${new URL(origin).hostname}`,
    startsAt: appointment.startsAt,
    endsAt: appointment.endsAt,
    updatedAt: appointment.updatedAt,
    title: `Vet consultation: ${appointment.pet.name} with ${vetName}`,
    description: [
      `Video consultation for ${appointment.pet.name} with ${vetName}${clinic ? ` (${clinic})` : ""}.`,
      `Join the call: ${roomUrl}`,
      `The room opens ${JOIN_WINDOW_BEFORE_MINUTES} minutes before the start.`,
      `To reschedule or cancel: ${origin}/appointments`,
    ].join("\n"),
    url: roomUrl,
    reminderMinutes: 15,
  });

  return new NextResponse(file, {
    headers: {
      "Content-Type": "text/calendar; charset=utf-8",
      "Content-Disposition": `attachment; filename="max-petcare-appointment.ics"`,
      // Personal, and stale the moment the appointment moves.
      "Cache-Control": "private, no-store",
    },
  });
}
