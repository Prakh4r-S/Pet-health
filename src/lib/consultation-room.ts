import { prisma } from "@/lib/prisma";
import { roomNameFor } from "@/lib/livekit";

/** The room opens shortly before the appointment. */
export const JOIN_WINDOW_BEFORE_MINUTES = 10;
/** And stays open a while after, for overruns. */
export const JOIN_WINDOW_AFTER_MINUTES = 30;

export type RoomAccess =
  | {
      ok: true;
      roomName: string;
      isVet: boolean;
      displayName: string;
      expiresAt: Date;
    }
  | {
      ok: false;
      reason: "NOT_FOUND" | "NOT_A_PARTICIPANT" | "TOO_EARLY" | "ENDED" | "CANCELLED";
      opensAt?: Date;
    };

/**
 * Decides whether this user may enter this consultation.
 *
 * Three questions, all answered server-side:
 *   1. Does the appointment exist and is it still scheduled?
 *   2. Is this user the owner or the assigned vet? Nobody else, however
 *      senior — a vet with no appointment here has no business in the
 *      call.
 *   3. Is it time? A room reachable at any hour is a room that can be
 *      re-entered days later.
 *
 * Only after all three does a token get minted. Note there is nothing to
 * create: with LiveKit the room exists precisely as long as someone
 * holding a valid token is inside it, so refusing the token is the same
 * as refusing the room.
 */
export async function getRoomAccess(
  appointmentId: string,
  userId: string,
): Promise<RoomAccess> {
  const appointment = await prisma.appointment.findUnique({
    where: { id: appointmentId },
    include: {
      owner: { select: { id: true, name: true } },
      vetProfile: { include: { user: { select: { id: true, name: true } } } },
    },
  });

  if (!appointment) return { ok: false, reason: "NOT_FOUND" };
  if (appointment.status === "CANCELLED") return { ok: false, reason: "CANCELLED" };

  const isOwner = appointment.ownerId === userId;
  const isVet = appointment.vetProfile.userId === userId;
  if (!isOwner && !isVet) return { ok: false, reason: "NOT_A_PARTICIPANT" };

  const now = new Date();
  const opensAt = new Date(
    appointment.startsAt.getTime() - JOIN_WINDOW_BEFORE_MINUTES * 60_000,
  );
  const closesAt = new Date(
    appointment.endsAt.getTime() + JOIN_WINDOW_AFTER_MINUTES * 60_000,
  );

  if (now < opensAt) return { ok: false, reason: "TOO_EARLY", opensAt };
  if (now > closesAt) return { ok: false, reason: "ENDED" };

  const displayName =
    (isVet ? appointment.vetProfile.user.name : appointment.owner.name) ?? "Participant";

  return {
    ok: true,
    roomName: roomNameFor(appointment.id),
    isVet,
    displayName,
    expiresAt: closesAt,
  };
}