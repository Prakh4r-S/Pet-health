"use server";

import { revalidatePath } from "next/cache";
import { prisma } from "@/lib/prisma";
import { getCurrentUser } from "@/lib/current-user";
import { fail, isUniqueViolation, ok, type ActionState } from "@/lib/action-result";
import { inspectBlob, MAX_UPLOAD_BYTES } from "@/lib/blob";
import { ALLOWED_IMAGE_TYPES, baseContentType, documentPrefix } from "@/lib/upload-rules";
import {
  followUpClosesAt,
  MAX_FOLLOW_UP_CHARS,
  MAX_FOLLOW_UP_MESSAGES,
} from "@/lib/follow-up";

/**
 * Adds a message, and optionally a photo, to a consultation's follow-up
 * thread.
 *
 * Only the two people who were on the appointment can post, and only
 * while the thread is open. The window is checked here against the
 * clock at the moment of posting — the form may have been sitting open
 * since before it closed.
 *
 * A photo arrives as the pathname of a file the browser has already put
 * in the blob store. As with any document, that is a claim: it must sit
 * under this pet's prefix, and its real size and type are read back from
 * the store before a Document row is made for it.
 */
export async function postFollowUp(input: {
  appointmentId: string;
  body: string;
  photoPathname?: string | null;
  photoName?: string | null;
}): Promise<ActionState> {
  const user = await getCurrentUser();

  const appointmentId = String(input.appointmentId ?? "");
  const body = String(input.body ?? "").trim();
  const photoPathname = input.photoPathname ? String(input.photoPathname) : null;

  if (!body && !photoPathname) return fail("Write a message or attach a photo.");
  if (body.length > MAX_FOLLOW_UP_CHARS) {
    return fail(`Keep the message under ${MAX_FOLLOW_UP_CHARS} characters.`);
  }

  // The caller has to be the owner or the vet on this appointment; an
  // id that is not theirs reads the same as one that does not exist.
  const appointment = await prisma.appointment.findFirst({
    where: {
      id: appointmentId,
      OR: [{ ownerId: user.id }, { vetProfile: { userId: user.id } }],
    },
    select: {
      id: true,
      petId: true,
      status: true,
      endsAt: true,
      note: { select: { finalisedAt: true } },
      _count: { select: { followUps: true } },
    },
  });
  if (!appointment) return fail("Consultation not found.");

  const closesAt = followUpClosesAt(appointment);
  if (!closesAt) return fail("Follow-up opens once the vet has finalised the record.");
  if (closesAt.getTime() <= Date.now()) {
    return fail("The follow-up window for this consultation has closed. Book a new consultation to carry on.");
  }
  if (appointment._count.followUps >= MAX_FOLLOW_UP_MESSAGES) {
    return fail("This thread is full. Book a new consultation to carry on.");
  }

  let photo: { pathname: string; contentType: string; sizeBytes: number } | null = null;
  if (photoPathname) {
    if (!photoPathname.startsWith(documentPrefix(appointment.petId))) {
      return fail("Invalid upload.");
    }
    const blob = await inspectBlob(photoPathname);
    if (!blob) return fail("Could not confirm the photo upload. Please try again.");
    const contentType = baseContentType(blob.contentType);
    if (!ALLOWED_IMAGE_TYPES.includes(contentType)) {
      return fail("Attach a JPEG, PNG or WebP photo.");
    }
    if (blob.sizeBytes > MAX_UPLOAD_BYTES) return fail("Photo must be under 10 MB.");
    photo = { pathname: blob.pathname, contentType, sizeBytes: blob.sizeBytes };
  }

  const title = String(input.photoName ?? "").trim().slice(0, 120) || "Follow-up photo";

  try {
    // Together or not at all: a photo with no message to hang from would
    // sit on the pet's record with nothing to say why it is there.
    await prisma.$transaction(async (tx) => {
      const document = photo
        ? await tx.document.create({
            data: {
              petId: appointment.petId,
              uploadedById: user.id,
              appointmentId: appointment.id,
              kind: "OTHER",
              title,
              note: "Sent in the follow-up thread after the consultation.",
              ...photo,
            },
            select: { id: true },
          })
        : null;

      await tx.followUpMessage.create({
        data: {
          appointmentId: appointment.id,
          authorId: user.id,
          body,
          documentId: document?.id ?? null,
        },
      });
    });
  } catch (error) {
    if (isUniqueViolation(error)) return fail("That photo has already been sent.");
    throw error;
  }

  revalidatePath("/appointments");
  revalidatePath(`/appointments/${appointment.id}/review`);
  revalidatePath("/vet/appointments");
  revalidatePath(`/pets/${appointment.petId}`);
  return ok;
}
