"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { prisma } from "@/lib/prisma";
import { getCurrentUser } from "@/lib/current-user";
import { fail, type ActionState } from "@/lib/action-result";
import { parseImageField } from "@/lib/upload-rules";

const SEXES = ["MALE", "FEMALE", "UNKNOWN"] as const;
type Sex = (typeof SEXES)[number];

export async function createPet(_previous: ActionState, formData: FormData): Promise<ActionState> {
  const user = await getCurrentUser();

  const name = String(formData.get("name") ?? "").trim();
  const speciesId = String(formData.get("speciesId") ?? "");
  const breedId = String(formData.get("breedId") ?? "") || null;
  const breedFreeText = String(formData.get("breedFreeText") ?? "").trim() || null;
  const sexRaw = String(formData.get("sex") ?? "UNKNOWN");
  const birthDateRaw = String(formData.get("birthDate") ?? "");
  const birthDateIsApprox = formData.get("birthDateIsApprox") === "on";

  // Validate on the server regardless of what the browser enforced.
  // HTML `required` attributes are a convenience, not a guarantee.
  if (!name) return fail("Name is required.");
  if (!speciesId) return fail("Species is required.");

  const photoUrl = parseImageField(formData.get("photoUrl"));
  if (photoUrl === false) return fail("That photo could not be used. Upload it again.");

  const sex: Sex = (SEXES as readonly string[]).includes(sexRaw) ? (sexRaw as Sex) : "UNKNOWN";

  const birthDate = birthDateRaw ? new Date(birthDateRaw) : null;
  if (birthDate && Number.isNaN(birthDate.valueOf())) return fail("Enter a valid date of birth.");
  if (birthDate && birthDate > new Date()) return fail("Date of birth cannot be in the future.");

  // Ids arrive from a form, so check they name real rows that belong
  // together rather than letting a foreign-key error surface as a 500.
  const species = await prisma.species.findUnique({
    where: { id: speciesId },
    select: { id: true },
  });
  if (!species) return fail("Choose a species.");

  if (breedId) {
    const breed = await prisma.breed.findFirst({
      where: { id: breedId, speciesId },
      select: { id: true },
    });
    if (!breed) return fail("That breed doesn't belong to the chosen species.");
  }

  await prisma.pet.create({
    data: {
      ownerId: user.id,
      speciesId,
      breedId,
      breedFreeText,
      name,
      sex,
      birthDate,
      birthDateIsApprox,
      photoUrl,
    },
  });

  revalidatePath("/pets");
  redirect("/pets");
}
