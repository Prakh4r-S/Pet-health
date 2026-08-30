"use server";

import { revalidatePath } from "next/cache";
import { prisma } from "@/lib/prisma";
import { getCurrentUser } from "@/lib/current-user";
import { uploadDocument, MAX_UPLOAD_BYTES } from "@/lib/blob";

/**
 * Saves an annotated frame from a consultation into the pet's record.
 *
 * Only the treating vet may do this, and only for the appointment they
 * are actually in — the pet id arrives from the client, so it is checked
 * against the appointment rather than trusted.
 */
export async function saveSnapshot(params: {
  appointmentId: string;
  petId: string;
  dataUrl: string;
  note: string | null;
}) {
  const user = await getCurrentUser();

  const appointment = await prisma.appointment.findFirst({
    where: {
      id: params.appointmentId,
      petId: params.petId,
      status: { in: ["SCHEDULED", "COMPLETED"] },
      vetProfile: { userId: user.id },
    },
    select: { id: true, petId: true },
  });

  if (!appointment) throw new Error("Not your consultation.");

  const match = /^data:image\/jpeg;base64,(.+)$/.exec(params.dataUrl);
  if (!match) throw new Error("Unexpected image format.");

  const bytes = Buffer.from(match[1], "base64");
  if (bytes.byteLength > MAX_UPLOAD_BYTES) throw new Error("Image too large.");

  const stamp = new Date().toISOString().replace(/[:.]/g, "-").slice(0, 19);

  const { pathname } = await uploadDocument({
    petId: appointment.petId,
    filename: `snapshot-${stamp}.jpg`,
    contentType: "image/jpeg",
    body: bytes,
  });

  await prisma.document.create({
    data: {
      petId: appointment.petId,
      uploadedById: user.id,
      appointmentId: appointment.id,
      kind: "CONSULTATION_SNAPSHOT",
      title: params.note || `Snapshot ${stamp.slice(0, 10)}`,
      note: params.note,
      pathname,
      contentType: "image/jpeg",
      sizeBytes: bytes.byteLength,
    },
  });

  revalidatePath(`/pets/${appointment.petId}`);
}

/** Snapshots taken during one consultation, for the in-call strip. */
export async function listSnapshots(appointmentId: string) {
  const user = await getCurrentUser();

  const appointment = await prisma.appointment.findFirst({
    where: { id: appointmentId, vetProfile: { userId: user.id } },
    select: { id: true },
  });
  if (!appointment) return [];

  const documents = await prisma.document.findMany({
    where: { appointmentId, kind: "CONSULTATION_SNAPSHOT" },
    orderBy: { createdAt: "desc" },
    select: { id: true, title: true, createdAt: true },
  });

  return documents.map((d) => ({
    id: d.id,
    title: d.title,
    takenAt: d.createdAt.toISOString(),
  }));
}
