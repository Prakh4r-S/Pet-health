import { prisma } from "@/lib/prisma";

export type PetAccess =
  | { role: "OWNER"; canEdit: true }
  | { role: "TREATING_VET"; canEdit: false; appointmentId: string }
  | null;

/**
 * Decides whether a user may see a pet's records, and in what capacity.
 *
 * Two distinct rules, and the difference matters:
 *
 *   - The owner has access because they possess the record.
 *   - A vet has access because of a *relationship* — an appointment with
 *     this specific pet. Not "any vet", not "a vet who asks". Access
 *     begins when an appointment is booked and persists afterwards, so
 *     the vet can review what they treated; a cancelled appointment
 *     confers nothing.
 *
 * Relationship-based access is the normal shape in health systems, and
 * it is why this cannot be a simple ownerId check. It is also why the
 * vet's access is read-only: seeing a history is not authority to
 * rewrite it.
 */
export async function getPetAccess(petId: string, userId: string): Promise<PetAccess> {
  const pet = await prisma.pet.findFirst({
    where: { id: petId, archivedAt: null },
    select: { ownerId: true },
  });
  if (!pet) return null;

  if (pet.ownerId === userId) return { role: "OWNER", canEdit: true };

  const appointment = await prisma.appointment.findFirst({
    where: {
      petId,
      status: { in: ["SCHEDULED", "COMPLETED"] },
      vetProfile: { userId },
    },
    select: { id: true },
    orderBy: { startsAt: "desc" },
  });

  if (appointment) {
    return { role: "TREATING_VET", canEdit: false, appointmentId: appointment.id };
  }

  return null;
}
