"use server";

import { revalidatePath } from "next/cache";
import { prisma } from "@/lib/prisma";
import { getCurrentUser } from "@/lib/current-user";
import { getPetAccess } from "@/lib/pet-access";
import {
  inspectBlob,
  deleteDocument,
  ALLOWED_CONTENT_TYPES,
  MAX_UPLOAD_BYTES,
} from "@/lib/blob";
import { baseContentType, documentPrefix } from "@/lib/upload-rules";
import { fail, isUniqueViolation, ok, type ActionState } from "@/lib/action-result";

const KINDS = [
  "LAB_REPORT",
  "PRESCRIPTION",
  "IMAGING",
  "VACCINATION_CERT",
  "CONSULTATION_SNAPSHOT",
  "OTHER",
] as const;
type Kind = (typeof KINDS)[number];

/**
 * Turns a file the browser has already uploaded into a document on the
 * pet's record.
 *
 * The file went straight to the blob store with a token from /api/upload,
 * so all that arrives here is where it landed. That is checked rather
 * than believed: the path must sit under this pet's prefix, the caller
 * must have access to this pet, and size and type are read back from the
 * store instead of being taken from the client.
 */
export async function registerPetDocument(input: {
  petId: string;
  pathname: string;
  title: string;
  kind: string;
  note?: string | null;
}): Promise<ActionState> {
  const user = await getCurrentUser();

  const petId = String(input.petId ?? "");
  const pathname = String(input.pathname ?? "");
  const title = String(input.title ?? "").trim().slice(0, 200);
  const note = String(input.note ?? "").trim() || null;

  // Both owner and treating vet may attach documents — a vet uploading a
  // lab report from the clinic is a normal thing to want.
  const access = await getPetAccess(petId, user.id);
  if (!access) return fail("Pet not found.");

  if (!pathname.startsWith(documentPrefix(petId))) return fail("Invalid upload.");

  const blob = await inspectBlob(pathname);
  if (!blob) return fail("Could not confirm the upload. Please try again.");

  // The upload token already enforced both of these. They are repeated
  // because this action can be called with any pathname under the prefix,
  // not only one that came from a token issued a moment ago.
  if (blob.sizeBytes > MAX_UPLOAD_BYTES) return fail("File must be under 10 MB.");
  const contentType = baseContentType(blob.contentType);
  if (!ALLOWED_CONTENT_TYPES.includes(contentType)) {
    return fail("Only PDF and image files are accepted.");
  }

  const kind: Kind = (KINDS as readonly string[]).includes(input.kind)
    ? (input.kind as Kind)
    : "OTHER";

  try {
    await prisma.document.create({
      data: {
        petId,
        uploadedById: user.id,
        kind,
        title: title || "Untitled document",
        note,
        pathname: blob.pathname,
        contentType,
        sizeBytes: blob.sizeBytes,
      },
    });
  } catch (error) {
    // pathname is unique: the same upload cannot be registered twice.
    if (isUniqueViolation(error)) {
      return fail("That file has already been added.");
    }
    throw error;
  }

  revalidatePath(`/pets/${petId}`);
  return ok;
}

export async function deletePetDocument(
  _previous: ActionState,
  formData: FormData,
): Promise<ActionState> {
  const user = await getCurrentUser();
  const id = String(formData.get("id") ?? "");

  const document = await prisma.document.findUnique({
    where: { id },
    select: { id: true, petId: true, pathname: true, uploadedById: true },
  });
  // Already gone — most likely removed in another tab. Nothing to do,
  // and nothing worth alarming anyone about.
  if (!document) return fail("That document has already been removed.");

  // Same answer for "no such document" and "not yours", as in the
  // download route: a stranger learns nothing about which ids exist.
  const access = await getPetAccess(document.petId, user.id);
  if (!access) return fail("That document has already been removed.");

  // Owners may remove anything in their pet's file; a vet may remove only
  // what they uploaded themselves. Deleting someone else's clinical
  // record is not a thing a treating vet should be able to do.
  const canDelete = access.role === "OWNER" || document.uploadedById === user.id;
  if (!canDelete) return fail("You can only remove documents you uploaded.");

  // Database row first. If the blob delete fails we are left with an
  // orphaned file, which is untidy but harmless; the reverse order would
  // leave a row pointing at nothing, which breaks the UI.
  await prisma.document.delete({ where: { id } });
  try {
    await deleteDocument(document.pathname);
  } catch {
    // orphaned blob; the record is gone, which is what was asked for
  }

  revalidatePath(`/pets/${document.petId}`);
  return ok;
}
