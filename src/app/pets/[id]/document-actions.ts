"use server";

import { revalidatePath } from "next/cache";
import { prisma } from "@/lib/prisma";
import { getCurrentUser } from "@/lib/current-user";
import { getPetAccess } from "@/lib/pet-access";
import {
  uploadDocument,
  deleteDocument,
  ALLOWED_CONTENT_TYPES,
  MAX_UPLOAD_BYTES,
} from "@/lib/blob";

const KINDS = [
  "LAB_REPORT",
  "PRESCRIPTION",
  "IMAGING",
  "VACCINATION_CERT",
  "CONSULTATION_SNAPSHOT",
  "OTHER",
] as const;
type Kind = (typeof KINDS)[number];

export async function uploadPetDocument(formData: FormData) {
  const user = await getCurrentUser();

  const petId = String(formData.get("petId") ?? "");
  const title = String(formData.get("title") ?? "").trim();
  const note = String(formData.get("note") ?? "").trim() || null;
  const kindRaw = String(formData.get("kind") ?? "OTHER");
  const appointmentId = String(formData.get("appointmentId") ?? "") || null;
  const file = formData.get("file");

  // Both owner and treating vet may attach documents — a vet uploading a
  // lab report from the clinic is a normal thing to want.
  const access = await getPetAccess(petId, user.id);
  if (!access) throw new Error("Pet not found.");

  if (!(file instanceof File) || file.size === 0) throw new Error("Choose a file.");
  if (file.size > MAX_UPLOAD_BYTES) throw new Error("File must be under 10 MB.");

  // Content type is checked, but note it comes from the client and is not
  // trustworthy on its own. It is enough to stop honest mistakes; a
  // production system would sniff the bytes.
  if (!ALLOWED_CONTENT_TYPES.includes(file.type)) {
    throw new Error("Only PDF and image files are accepted.");
  }

  const kind: Kind = (KINDS as readonly string[]).includes(kindRaw)
    ? (kindRaw as Kind)
    : "OTHER";

  const bytes = Buffer.from(await file.arrayBuffer());

  const { pathname } = await uploadDocument({
    petId,
    filename: file.name,
    contentType: file.type,
    body: bytes,
  });

  await prisma.document.create({
    data: {
      petId,
      uploadedById: user.id,
      appointmentId,
      kind,
      title: title || file.name,
      note,
      pathname,
      contentType: file.type,
      sizeBytes: file.size,
    },
  });

  revalidatePath(`/pets/${petId}`);
}

export async function deletePetDocument(formData: FormData) {
  const user = await getCurrentUser();
  const id = String(formData.get("id") ?? "");

  const document = await prisma.document.findUnique({
    where: { id },
    select: { id: true, petId: true, pathname: true, uploadedById: true },
  });
  if (!document) throw new Error("Document not found.");

  const access = await getPetAccess(document.petId, user.id);
  if (!access) throw new Error("Not found.");

  // Owners may remove anything in their pet's file; a vet may remove only
  // what they uploaded themselves. Deleting someone else's clinical
  // record is not a thing a treating vet should be able to do.
  const canDelete = access.role === "OWNER" || document.uploadedById === user.id;
  if (!canDelete) throw new Error("You can only remove documents you uploaded.");

  // Database row first. If the blob delete fails we are left with an
  // orphaned file, which is untidy but harmless; the reverse order would
  // leave a row pointing at nothing, which breaks the UI.
  await prisma.document.delete({ where: { id } });
  await deleteDocument(document.pathname);

  revalidatePath(`/pets/${document.petId}`);
}
